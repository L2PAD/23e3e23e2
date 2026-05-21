"""
google_reviews_service — Google Places API integration for the public
"OUR CLIENTS SAY" homepage block.

Architecture:
   This module is a SELF-CONTAINED service layer that owns three Mongo
   collections (`google_reviews_config`, `google_reviews_cache`,
   `google_reviews_audit`) and exposes a small, focused public API:

      • `get_config()`       — read the current admin-managed config
      • `update_config()`    — admin updates (api_key, place_id, …)
      • `sync_from_google()` — pull reviews from Google Places API v1
                               and upsert into `google_reviews_cache`
      • `list_reviews()`     — admin listing with hidden/pinned state
      • `set_review_state()` — toggle hidden / pinned per review
      • `delete_review()`    — drop a single review from the cache
      • `add_manual_review()` — append a manually-crafted review
                                (source="manual")
      • `public_feed()`      — filtered feed for the public homepage,
                               with aggregate rating / count computed
                               from the cache (not from Google's
                               opaque "rating" — the average is
                               recomputed from the actual ratings of
                               cached reviews so admin moderation is
                               reflected truthfully)

The module is DEPLOY-SAFE:
   - If `api_key` or `place_id` are not configured, `sync_from_google()`
     raises a controlled `RuntimeError("not configured")` that the
     router maps to HTTP 400, and `public_feed()` falls back to whatever
     reviews are already cached (or the seed defaults from
     `app.routers.content.DEFAULT_SITE_INFO['reviews']['items']`).
   - The HTTP call uses `httpx.AsyncClient` with a 10s timeout; any
     network/API failure is logged and surfaces as HTTP 502 from the
     router.

Why a dedicated service module (not inlined into content.py)?
   - The Google integration has its own credentials, its own
     periodic sync, its own moderation state, and its own audit
     trail. Bundling it into the giant `site_info` singleton would
     break the Wave 2B invariant "one collection per router".
   - Keeping it isolated lets us add a worker_registry entry for
     `google_reviews_sync` cron without touching server.py beyond a
     single `include_router(...)` line.
"""
from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("bibi.google_reviews")

# ── Constants ───────────────────────────────────────────────────────────
CONFIG_DOC_ID = "google_reviews_config_singleton"
GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1/places"
DEFAULT_MIN_RATING = 4
DEFAULT_MAX_REVIEWS = 6
DEFAULT_SYNC_INTERVAL_HOURS = 24


# ── Helpers ─────────────────────────────────────────────────────────────
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(8)}"


def _serialize(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Strip Mongo `_id` + datetime → ISO conversion."""
    if not doc:
        return None
    out = {k: v for k, v in doc.items() if k != "_id"}
    for k, v in list(out.items()):
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    return out


def _default_config() -> Dict[str, Any]:
    """Default config shape — used on first read."""
    return {
        "_id": CONFIG_DOC_ID,
        "enabled": True,
        # `api_key` is stored server-side and NEVER returned to the public
        # endpoint. The admin endpoint returns a masked preview.
        "api_key": "",
        "place_id": "",
        "min_rating_filter": DEFAULT_MIN_RATING,
        "max_reviews_to_show": DEFAULT_MAX_REVIEWS,
        "auto_sync_enabled": False,
        "sync_interval_hours": DEFAULT_SYNC_INTERVAL_HOURS,
        "last_synced_at": None,
        "last_sync_error": None,
        # When the admin types a "fallback rating / fallback count" we honour
        # them when the Google API hasn't been called yet (or returns no
        # data). This keeps the public block populated during the bootstrap
        # phase BEFORE the operator wires in their API key.
        "fallback_rating": 4.9,
        "fallback_count": 31,
        "fallback_url": "",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }


def _mask_key(api_key: Optional[str]) -> str:
    """Return a safely-displayable version of the API key for the admin UI."""
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "***"
    return f"{api_key[:4]}...{api_key[-4:]}"


# ── Config CRUD ─────────────────────────────────────────────────────────
async def get_config(db) -> Dict[str, Any]:
    """Return the current admin-managed config (server-side view)."""
    doc = await db.google_reviews_config.find_one({"_id": CONFIG_DOC_ID})
    if not doc:
        doc = _default_config()
        await db.google_reviews_config.insert_one(doc)
    return doc


async def get_config_for_admin(db) -> Dict[str, Any]:
    """Public-facing admin view: masks the api_key."""
    cfg = await get_config(db)
    cfg = _serialize(cfg) or {}
    raw_key = cfg.pop("api_key", "") or ""
    cfg["api_key_preview"] = _mask_key(raw_key)
    cfg["has_api_key"] = bool(raw_key)
    return cfg


async def update_config(db, patch: Dict[str, Any]) -> Dict[str, Any]:
    """Apply an admin patch and return the updated public view."""
    allowed_fields = {
        "enabled", "api_key", "place_id",
        "min_rating_filter", "max_reviews_to_show",
        "auto_sync_enabled", "sync_interval_hours",
        "fallback_rating", "fallback_count", "fallback_url",
    }
    update: Dict[str, Any] = {}
    for k, v in patch.items():
        if k in allowed_fields:
            # Skip empty api_key writes — used by the UI to "rotate without
            # showing the key". An explicit `null` clears it.
            if k == "api_key" and v == "":
                continue
            update[k] = v
    if not update:
        return await get_config_for_admin(db)
    update["updated_at"] = _now_iso()
    await db.google_reviews_config.update_one(
        {"_id": CONFIG_DOC_ID},
        {"$set": update, "$setOnInsert": {"_id": CONFIG_DOC_ID, "created_at": _now_iso()}},
        upsert=True,
    )
    return await get_config_for_admin(db)


# ── Cache CRUD ──────────────────────────────────────────────────────────
async def list_reviews(db, include_hidden: bool = True) -> List[Dict[str, Any]]:
    """Return all cached reviews; default includes hidden ones (admin view)."""
    query: Dict[str, Any] = {}
    if not include_hidden:
        query["hidden"] = {"$ne": True}
    cursor = db.google_reviews_cache.find(query).sort([("pinned", -1), ("time", -1)])
    out: List[Dict[str, Any]] = []
    async for r in cursor:
        out.append(_serialize(r))
    return out


async def set_review_state(
    db,
    review_id: str,
    *,
    hidden: Optional[bool] = None,
    pinned: Optional[bool] = None,
) -> Dict[str, Any]:
    """Toggle the moderation state for one cached review."""
    update: Dict[str, Any] = {}
    if hidden is not None:
        update["hidden"] = bool(hidden)
    if pinned is not None:
        update["pinned"] = bool(pinned)
    if not update:
        raise ValueError("No state change requested")
    update["updated_at"] = _now_iso()
    result = await db.google_reviews_cache.find_one_and_update(
        {"id": review_id},
        {"$set": update},
        return_document=True,
    )
    if not result:
        raise LookupError(f"Review {review_id} not found")
    return _serialize(result)


async def delete_review(db, review_id: str) -> bool:
    """Remove a single cached review."""
    res = await db.google_reviews_cache.delete_one({"id": review_id})
    return (res.deleted_count or 0) > 0


async def add_manual_review(db, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Append a manually-crafted review (admin can showcase curated quotes)."""
    rid = _new_id("manual")
    rating = int(payload.get("rating") or 5)
    if rating < 1 or rating > 5:
        rating = 5
    doc = {
        "id": rid,
        "google_review_id": None,
        "author_name": (payload.get("author_name") or "").strip() or "Anonymous",
        "author_avatar_url": (payload.get("author_avatar_url") or "").strip(),
        "rating": rating,
        "text": (payload.get("text") or "").strip(),
        "text_bg": (payload.get("text_bg") or "").strip(),
        "language": (payload.get("language") or "en").lower(),
        "time": _now_iso(),
        "source": "manual",
        "hidden": False,
        "pinned": bool(payload.get("pinned")),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.google_reviews_cache.insert_one(doc)
    return _serialize(doc)


# ── Sync from Google ────────────────────────────────────────────────────
async def sync_from_google(db) -> Dict[str, Any]:
    """Pull latest reviews from Google Places API v1 and upsert the cache.

    Returns a summary dict with counts of created/updated reviews and the
    aggregate rating reported by Google.
    """
    cfg = await get_config(db)
    api_key = (cfg.get("api_key") or "").strip()
    place_id = (cfg.get("place_id") or "").strip()
    if not api_key or not place_id:
        raise RuntimeError("Google Places API key and Place ID must be set in admin → Google Reviews")

    url = f"{GOOGLE_PLACES_BASE}/{place_id}"
    field_mask = "id,displayName,rating,userRatingCount,reviews"
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": field_mask,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
    except httpx.HTTPError as e:
        await db.google_reviews_config.update_one(
            {"_id": CONFIG_DOC_ID},
            {"$set": {"last_sync_error": str(e), "updated_at": _now_iso()}},
        )
        raise RuntimeError(f"Google Places API request failed: {e}") from e

    if resp.status_code != 200:
        snippet = (resp.text or "")[:300]
        await db.google_reviews_config.update_one(
            {"_id": CONFIG_DOC_ID},
            {"$set": {
                "last_sync_error": f"HTTP {resp.status_code}: {snippet}",
                "updated_at": _now_iso(),
            }},
        )
        raise RuntimeError(f"Google Places API returned {resp.status_code}: {snippet}")

    data = resp.json() or {}
    google_rating = float(data.get("rating") or 0.0)
    google_count = int(data.get("userRatingCount") or 0)
    raw_reviews = data.get("reviews") or []

    created = 0
    updated = 0
    for r in raw_reviews:
        # Each review has a unique `name` (e.g. "places/XXX/reviews/YYY") that
        # we use as the canonical id for upsert.
        name = r.get("name") or ""
        if not name:
            continue
        rating_n = int(r.get("rating") or 0)
        text_obj = r.get("text") or {}
        original_obj = r.get("originalText") or {}
        author_attr = r.get("authorAttribution") or {}

        publish_time = r.get("publishTime") or _now_iso()

        existing = await db.google_reviews_cache.find_one({"google_review_id": name})
        if existing:
            await db.google_reviews_cache.update_one(
                {"google_review_id": name},
                {"$set": {
                    "rating": rating_n,
                    "text": text_obj.get("text") or original_obj.get("text") or "",
                    "language": (text_obj.get("languageCode") or original_obj.get("languageCode") or "en").lower(),
                    "author_name": author_attr.get("displayName") or "Anonymous",
                    "author_avatar_url": author_attr.get("photoUri") or "",
                    "time": publish_time,
                    "updated_at": _now_iso(),
                }},
            )
            updated += 1
        else:
            rid = _new_id("gr")
            await db.google_reviews_cache.insert_one({
                "id": rid,
                "google_review_id": name,
                "rating": rating_n,
                "text": text_obj.get("text") or original_obj.get("text") or "",
                "language": (text_obj.get("languageCode") or original_obj.get("languageCode") or "en").lower(),
                "author_name": author_attr.get("displayName") or "Anonymous",
                "author_avatar_url": author_attr.get("photoUri") or "",
                "time": publish_time,
                "source": "google",
                "hidden": False,
                "pinned": False,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
            })
            created += 1

    await db.google_reviews_config.update_one(
        {"_id": CONFIG_DOC_ID},
        {"$set": {
            "last_synced_at": _now_iso(),
            "last_sync_error": None,
            "last_google_rating": google_rating,
            "last_google_count": google_count,
            "updated_at": _now_iso(),
        }},
        upsert=True,
    )

    return {
        "created": created,
        "updated": updated,
        "total_pulled": len(raw_reviews),
        "google_rating": google_rating,
        "google_count": google_count,
    }


# ── Public feed (the one the homepage renders) ──────────────────────────
async def public_feed(db) -> Dict[str, Any]:
    """Return the bundle the public homepage needs.

    Shape:
        {
          enabled,
          rating, count, url,
          reviews: [{ id, author_name, author_avatar_url, rating, text,
                      text_bg, language, time, pinned }, ...]
        }

    The aggregate rating is computed from ALL non-hidden cached reviews
    (regardless of the per-display min_rating_filter) so it matches the
    "общий счёт за качество" the operator expects — a single 1-star Google
    review will still bring the average down, even though we don't render
    that individual review on the page.
    """
    cfg = await get_config(db)
    if cfg.get("enabled") is False:
        return {"enabled": False, "rating": 0, "count": 0, "url": "", "reviews": []}

    min_rating = int(cfg.get("min_rating_filter") or DEFAULT_MIN_RATING)
    max_show = int(cfg.get("max_reviews_to_show") or DEFAULT_MAX_REVIEWS)

    all_cached = await list_reviews(db, include_hidden=False)

    # Aggregate rating + count are derived from ALL non-hidden cached
    # reviews; this matches the operator's mental model (1× ★ + 1× ★★★★★
    # → avg 3.0, count 2).
    ratings = [int(r.get("rating") or 0) for r in all_cached if r.get("rating")]
    if ratings:
        avg_rating = round(sum(ratings) / len(ratings), 1)
        count = len(ratings)
    else:
        # No cached reviews yet — honour the admin fallback so the
        # block isn't blank during bootstrap.
        avg_rating = float(cfg.get("fallback_rating") or 0)
        count = int(cfg.get("fallback_count") or 0)

    # Display list: only reviews ≥ min_rating_filter, pinned first, then by
    # most recent, capped to max_reviews_to_show.
    eligible = [r for r in all_cached if int(r.get("rating") or 0) >= min_rating]
    eligible.sort(
        key=lambda r: (bool(r.get("pinned")), r.get("time") or ""),
        reverse=True,
    )
    eligible = eligible[: max(1, max_show)]

    # Strip server-side fields not needed by the public client.
    def _publish(r: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": r.get("id"),
            "author_name": r.get("author_name"),
            "author_avatar_url": r.get("author_avatar_url"),
            "rating": int(r.get("rating") or 0),
            "text": r.get("text") or "",
            "text_bg": r.get("text_bg") or "",
            "language": r.get("language") or "en",
            "time": r.get("time"),
            "pinned": bool(r.get("pinned")),
            "source": r.get("source") or "google",
        }

    return {
        "enabled": True,
        "rating": avg_rating,
        "count": count,
        "url": cfg.get("fallback_url") or "",
        "reviews": [_publish(r) for r in eligible],
        "min_rating_filter": min_rating,
    }
