/**
 * FrameComponent21 — "Top vehicles deals of the week" cards grid.
 *
 * Loads in parallel:
 *   • GET /api/public/featured?limit=12   → real BidMotors lots
 *   • GET /api/favorites/me               → user favorites (silent if guest)
 *   • GET /api/compare/me                 → user compare list
 *
 * Renders 6 cards by default and toggles to 12 when the user clicks
 * "MORE VEHICLES +". Each card receives the favorite / compare Sets so
 * heart & scales icons reflect server state immediately.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import Card1 from "./card1";
import { userEngagementApi } from "../../lib/api";
import { useTiltParallax } from "../../components/useTiltParallax";
import useInView from "../../components/useInView";
import { useLang } from "../../i18n";
import styles from "./frame-component21.module.css";

const API = process.env.REACT_APP_BACKEND_URL || "";

const PLACEHOLDER_IMGS = [
  "/figma/image-15@2x.webp",
  "/figma/image-151@2x.webp",
  "/figma/image-152@2x.webp",
  "/figma/image-153@2x.webp",
  "/figma/image-154@2x.webp",
  "/figma/image-155@2x.webp",
];

const FrameComponent21 = ({ className = "" }) => {
  const [items, setItems] = useState(null); // null = loading
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(null);
  const { lang } = useLang();
  const isBg = lang === "bg";

  // Selection sets propagated to Card1
  const [favSet, setFavSet] = useState(new Set());
  const [cmpSet, setCmpSet] = useState(new Set());
  const [cmpCount, setCmpCount] = useState(0);

  /* ── Load real lots ─────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/api/public/featured`, {
          params: { limit: 12 },
          timeout: 18000,
        });
        if (!cancelled) {
          const arr = Array.isArray(data?.items) ? data.items : [];
          setItems(arr);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "fetch failed");
          setItems([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Load favorites + compare once (silent on guest) ─────────────── */
  const loadEngagement = useCallback(async () => {
    try {
      const favs = await userEngagementApi.favorites.getMine();
      if (Array.isArray(favs)) {
        setFavSet(new Set(favs.map((f) => (f.vin || f.vehicleId || "").toUpperCase()).filter(Boolean)));
      }
    } catch {/* unauth or API down → leave empty */}
    try {
      const cmp = await userEngagementApi.compare.getMine();
      const list = Array.isArray(cmp) ? cmp : (cmp?.items || []);
      const ids = list.map((c) => (c.vin || c.vehicleId || "").toUpperCase()).filter(Boolean);
      setCmpSet(new Set(ids));
      setCmpCount(ids.length);
    } catch {/* leave empty */}
  }, []);

  useEffect(() => { loadEngagement(); }, [loadEngagement]);

  /* ── Optimistic toggles propagated from Card1 ─────────────────────── */
  const handleToggleFavorite = useCallback((vin, next) => {
    if (!vin) return;
    const v = vin.toUpperCase();
    setFavSet((prev) => {
      const ns = new Set(prev);
      if (next) ns.add(v); else ns.delete(v);
      return ns;
    });
  }, []);

  const handleToggleCompare = useCallback((vin, next) => {
    if (!vin) return;
    const v = vin.toUpperCase();
    setCmpSet((prev) => {
      const ns = new Set(prev);
      if (next) ns.add(v); else ns.delete(v);
      return ns;
    });
    setCmpCount((c) => Math.max(0, c + (next ? 1 : -1)));
  }, []);

  const toggleExpand = useCallback(() => setExpanded((v) => !v), []);

  /* ── Build rows ───────────────────────────────────────────────────── */
  const live = items && items.length > 0 ? items : null;
  const visibleCount = expanded ? 12 : 6;
  const rows = [];
  if (live) {
    const slice = live.slice(0, visibleCount);
    for (let i = 0; i < slice.length; i += 3) rows.push(slice.slice(i, i + 3));
  } else {
    rows.push([0, 1, 2]);
    rows.push([3, 4, 5]);
  }
  const hasMoreToShow = live ? live.length > 6 : false;

  // Reusable BIBI tilt-parallax for the car cards. The `:scope .${...}`
  // selector reaches into both rows since the IO is one-shot per card.
  // Pass `live` + `expanded` as deps so the hook re-attaches when async
  // data arrives or the "More vehicles" toggle reveals additional cards.
  const blockRef = useRef(null);
  useTiltParallax(blockRef, {
    cardsSelector: `:scope .${styles.carBlock}`,
    // Entry animation is owned by the site-wide `reveal--fade-up` cascade
    // (see the <section> elements below). Without this flag, tilt-card
    // and reveal--fade-up race for opacity/transform → cards flicker
    // and the entry animation only plays "sometimes" depending on which
    // observer fires first. `skipEntry` keeps the hover/tilt behavior
    // while letting reveal--fade-up own the entry.
    skipEntry: true,
    deps: [live, expanded],
  });

  // Viewport observer for the section — flips `inView` once the deals
  // grid scrolls into view, then triggers the stagger reveal.
  const [sectionRef, inView] = useInView();
  // Track previously-revealed count so the second batch (cards 7-12)
  // staggers independently of the first when the user clicks "More".
  const prevCountRef = useRef(6);
  const prevCount = prevCountRef.current;
  prevCountRef.current = visibleCount;

  return (
    <div ref={sectionRef} className={[styles.cardsBlockWrapper, className, inView ? "is-visible" : ""].join(" ")}>
      <div ref={blockRef} className={`${styles.cardsBlock} tilt-scope`}>
        {rows.map((row, ri) => (
          <div className={styles.cardsParent} key={`row-${ri}`}>
            {row.map((cell, ci) => {
              const cardIdx = ri * 3 + ci;
              const isFresh = cardIdx >= prevCount;
              const delayIdx = isFresh ? (cardIdx - prevCount) : (cardIdx % 6);
              /* 140 ms stagger step (instead of 100 ms) gives a clearly
               * visible left-to-right wave across the 3-card row — same
               * timing language as the hero per-char wave and the
               * filter-row chips above. */
              const animStyle = { animationDelay: `${delayIdx * 140}ms` };
              if (live) {
                const v = cell;
                return (
                  <section
                    className={`${styles.carBlock} reveal reveal--fade-up`}
                    style={animStyle}
                    key={v.vin || `${ri}-${ci}`}
                  >
                    <Card1
                      data={v}
                      favoriteSet={favSet}
                      compareSet={cmpSet}
                      compareCount={cmpCount}
                      onToggleFavoriteLocal={handleToggleFavorite}
                      onToggleCompareLocal={handleToggleCompare}
                    />
                  </section>
                );
              }
              const idx = typeof cell === "number" ? cell : cardIdx;
              return (
                <section
                  className={`${styles.carBlock} reveal reveal--fade-up`}
                  style={animStyle}
                  key={`ph-${idx}`}
                >
                  <Card1 image15={PLACEHOLDER_IMGS[idx % PLACEHOLDER_IMGS.length]} />
                </section>
              );
            })}
          </div>
        ))}

        {hasMoreToShow && (
          <div style={{ display: "flex", justifyContent: "center", padding: "32px 0 0" }}>
            <button
              type="button"
              onClick={toggleExpand}
              data-testid="top-deals-more-toggle"
              style={{
                background: "transparent", border: 0, color: "#FEAE00",
                fontFamily: "var(--font-mazzard)", fontSize: 18, fontWeight: 500,
                letterSpacing: "0.06em", textTransform: "uppercase",
                textDecoration: "underline", cursor: "pointer", padding: "8px 12px",
              }}
            >
              {expanded
                ? (isBg ? "по-малко автомобили −" : "less vehicles −")
                : (isBg ? "още автомобили +" : "more vehicles +")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FrameComponent21;
