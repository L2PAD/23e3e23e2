/**
 * useCarByVin — fetches a single car/lot from the backend by VIN (or lot/slug).
 *
 * Hits `/api/vin/<VIN>` which is the canonical LIVE-FIRST VIN lookup endpoint
 * (SEARCH → WESTMOTORS → LEMON → PAGE fallback, plus stat.vin enrichment in
 * parallel). Returns a normalised, UI-ready shape so the Single Car page can
 * stay pixel-locked to the Figma spec without touching transport concerns.
 *
 * The hook is intentionally lightweight (no global cache): the page is a
 * direct landing target from header search / homepage cards, so duplicate
 * requests are rare. Backend has its own TTL cache via `vin_service`.
 */
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  formatTitle,
  formatMileage,
  formatDrivetrain,
  formatEngine,
  formatLocation,
  formatPrice,
  formatStatus,
  formatBodyStyle,
  buildDescription,
  pickImages,
  formatUpdated,
} from "./formatters";

const API_URL = process.env.REACT_APP_BACKEND_URL || "";

/**
 * Normalise the backend payload into the shape consumed by <ImageGrid />.
 */
function toCarVM(payload) {
  if (!payload?.found || !payload?.data) return null;
  const d = payload.data;
  const h = payload.history || null;

  const images = pickImages(d, h);
  const status = formatStatus(d, h);
  const title = formatTitle(d);

  return {
    vin: d.vin,
    title,
    status,
    isLive: !!d.is_live,
    isHistoryOnly: !!d._history_only,
    auctionUrl: d.url || d.source_url || null,
    images,
    imageCount: d.image_count || images.length,
    vehicle: {
      brand: d.make || "—",
      model: d.model || "—",
      year: d.year != null ? String(d.year) : "—",
      mileage: formatMileage(d.odometer, d.odometer_unit),
      damage: d.damage_primary || h?.damage_primary || "—",
      location: formatLocation(d.location || h?.location),
      fuel: d.fuel_type || h?.fuel_type || "—",
      transmission: d.transmission || h?.transmission || "—",
      bodyType: formatBodyStyle(d.body_style, d),
      driveType: formatDrivetrain(d.drivetrain),
      engineVolume: formatEngine(d.engine),
    },
    auction: {
      lot: d.lot_number || h?.lot_number || "—",
      vin: d.vin,
      auction: (d.auction_name || h?.auction_name || "—").toString().toUpperCase(),
      updated: formatUpdated(d.sale_date || h?.sale_date),
      bidPrice: formatPrice(d.current_bid ?? d.price ?? h?.sale_price_usd, d),
      bidPriceRaw: Number(d.current_bid ?? d.price ?? 0) || 0,
      estimatedTotalPrice: null, // filled in by the calculator effect (parent)
    },
    description: buildDescription(d, h),
    raw: payload,
  };
}

export default function useCarByVin(vinOrSlug) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [car, setCar] = useState(null);
  const [raw, setRaw] = useState(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!vinOrSlug) {
      setLoading(false);
      setError("Missing VIN");
      setCar(null);
      return;
    }
    const v = String(vinOrSlug).trim().toUpperCase();
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/vin/${encodeURIComponent(v)}`, {
          timeout: 25000,
        });
        if (reqIdRef.current !== reqId) return; // stale
        setRaw(data);
        if (!data || data.found === false) {
          setCar(null);
          setError("not_found");
        } else {
          setCar(toCarVM(data));
        }
      } catch (e) {
        if (reqIdRef.current !== reqId) return;
        setError(extractErrorMessage(e));
        setCar(null);
      } finally {
        if (reqIdRef.current === reqId) setLoading(false);
      }
    })();
  }, [vinOrSlug]);

  return { loading, error, car, raw };
}

/**
 * Convert any error response (axios error, Pydantic 422 detail array, plain
 * string, etc.) into a single human-readable string. Critical: React must
 * never receive a raw object as a child — rendering `{detail}` where detail
 * is `[{type, loc, msg, input, ctx, url}]` throws "Objects are not valid as
 * a React child" and unmounts the whole subtree.
 */
function extractErrorMessage(err) {
  if (!err) return "Unknown error";
  // axios style
  const data = err?.response?.data;
  const status = err?.response?.status;
  if (data) {
    if (typeof data === "string") return data;
    if (Array.isArray(data?.detail)) {
      const msgs = data.detail
        .map((d) => (typeof d === "string" ? d : (d?.msg || d?.message || "")))
        .filter(Boolean);
      if (msgs.length) return msgs.join("; ");
    }
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.detail === "object") return data.detail?.msg || JSON.stringify(data.detail);
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error === "string") return data.error;
  }
  if (typeof err?.message === "string") return err.message;
  if (status) return `Request failed (HTTP ${status})`;
  return "Network error";
}
