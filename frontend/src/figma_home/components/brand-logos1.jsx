/**
 * BrandLogos1 — "Search for cars from America and Korea / Most popular brands".
 *
 * • 6 brands shown by default (matching Figma — Audi, BMW, Jeep, Toyota, Ford, Hyundai).
 * • Click "OTHER BRANDS +" → grid expands by 6 more rows. Repeat until everything is shown.
 *   The toggle then becomes "HIDE BRANDS −".
 * • Each brand card links to `/catalog?make=<slug>` (catalog page is the future
 *   filter target — the link is harmless when the page is not yet built).
 *
 * Logos are pulled from BidMotors' CDN (51 brands in a single 3D-metallic
 * style consistent with the rest of the site) and self-hosted under
 * `/figma/brands/<slug>.png`.
 */
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../i18n";
import useInView from "../../components/useInView";
import styles from "./brand-logos1.module.css";

/* The default 6 — pinned to match the original Figma export */
const FEATURED_SLUGS = ["audi", "bmw", "jeep", "toyota", "ford", "hyundai"];

/* Full list (51) — exact set BidMotors lists on its homepage */
const BRANDS = [
  { slug: "acura",        name: "Acura" },
  { slug: "alfa-romeo",   name: "Alfa Romeo" },
  { slug: "aston-martin", name: "Aston Martin" },
  { slug: "audi",         name: "Audi" },
  { slug: "bentley",      name: "Bentley" },
  { slug: "bmw",          name: "BMW" },
  { slug: "buick",        name: "Buick" },
  { slug: "cadillac",     name: "Cadillac" },
  { slug: "chevrolet",    name: "Chevrolet" },
  { slug: "chrysler",     name: "Chrysler" },
  { slug: "dodge",        name: "Dodge" },
  { slug: "ferrari",      name: "Ferrari" },
  { slug: "fiat",         name: "Fiat" },
  { slug: "ford",         name: "Ford" },
  { slug: "genesis",      name: "Genesis" },
  { slug: "gmc",          name: "GMC" },
  { slug: "honda",        name: "Honda" },
  { slug: "hummer",       name: "Hummer" },
  { slug: "hyundai",      name: "Hyundai" },
  { slug: "infiniti",     name: "Infiniti" },
  { slug: "international",name: "International" },
  { slug: "isuzu",        name: "Isuzu" },
  { slug: "jaguar",       name: "Jaguar" },
  { slug: "jeep",         name: "Jeep" },
  { slug: "kia",          name: "Kia" },
  { slug: "lamborghini",  name: "Lamborghini" },
  { slug: "land-rover",   name: "Land Rover" },
  { slug: "lexus",        name: "Lexus" },
  { slug: "lincoln",      name: "Lincoln" },
  { slug: "lotus",        name: "Lotus" },
  { slug: "maserati",     name: "Maserati" },
  { slug: "mazda",        name: "Mazda" },
  { slug: "mercedes",     name: "Mercedes-Benz" },
  { slug: "mg",           name: "MG" },
  { slug: "mini",         name: "Mini" },
  { slug: "mitsubishi",   name: "Mitsubishi" },
  { slug: "nissan",       name: "Nissan" },
  { slug: "polestar",     name: "Polestar" },
  { slug: "pontiac",      name: "Pontiac" },
  { slug: "porsche",      name: "Porsche" },
  { slug: "ram",          name: "RAM" },
  { slug: "rolls-royce",  name: "Rolls-Royce" },
  { slug: "saab",         name: "Saab" },
  { slug: "smart",        name: "Smart" },
  { slug: "subaru",       name: "Subaru" },
  { slug: "suzuki",       name: "Suzuki" },
  { slug: "tesla",        name: "Tesla" },
  { slug: "toyota",       name: "Toyota" },
  { slug: "volkswagen",   name: "Volkswagen" },
  { slug: "volvo",        name: "Volvo" },
  { slug: "yamaha",       name: "Yamaha" },
].map((b) => ({ ...b, src: `/figma/brands/${b.slug}.webp` }));

const PAGE = 6;

const BrandLogos1 = ({ className = "" }) => {
  const { lang } = useLang();
  const isBg = lang === "bg";
  const T = isBg
    ? {
        title: "Най-популярни марки",
        otherBrands: "други марки +",
        hideBrands: "скрий марките −",
        brandsLabel: "марки",
        browse: (n) => `Преглед на ${n}`,
      }
    : {
        title: "most popular brands",
        otherBrands: "other brands +",
        hideBrands: "hide brands −",
        brandsLabel: "brands",
        browse: (n) => `Browse ${n}`,
      };
  /* Order: featured 6 first, then the rest A→Z */
  const ordered = useMemo(() => {
    const featured = FEATURED_SLUGS
      .map((s) => BRANDS.find((b) => b.slug === s))
      .filter(Boolean);
    const rest = BRANDS.filter((b) => !FEATURED_SLUGS.includes(b.slug));
    return [...featured, ...rest];
  }, []);

  const [visible, setVisible] = useState(PAGE);
  const total = ordered.length;
  const showAllBtn = visible < total;
  const collapsed = visible === PAGE;

  // Track how many items had already been revealed BEFORE the latest
  // expansion so we only stagger the NEW ones. Existing items keep
  // their fade-in state (animation-fill-mode: both) and don't replay.
  const prevVisibleRef = useRef(PAGE);
  const revealStart = prevVisibleRef.current;
  // Update for next render
  prevVisibleRef.current = visible;

  // Viewport observer for the whole brands section — flips `inView`
  // the first time the grid scrolls into view, triggering the initial
  // 6-logo cascade.
  const [sectionRef, inView] = useInView();

  const handleMore = () => {
    setVisible((v) => Math.min(total, v + PAGE));
  };
  const handleHide = () => {
    setVisible(PAGE);
    prevVisibleRef.current = 0;
  };

  return (
    <section ref={sectionRef} className={[styles.brandLogos, className, inView ? "is-visible" : ""].join(" ")}>
      <div className={styles.popularBrands}>
        <div className={styles.rectangleParent}>
          <div className={styles.brandsHeader}>
            <h2 className={styles.mostPopularBrands}>{T.title}</h2>
          </div>

          {/* Brands grid — 6 per row.
              When >6 are visible we render multiple rows; the original single
              row layout (with vertical dividers) is preserved on the first
              line for visual continuity. */}
          <div className={styles.brandsGrid}>
            {ordered.slice(0, visible).map((b, i) => {
              // Items revealed BEFORE the latest expansion get an already-
              // animated state (no fresh cascade). New items animate with
              // a staggered delay based on their position inside the chunk.
              const isFresh = i >= revealStart;
              const delayIdx = isFresh ? (i - revealStart) : (i % PAGE);
              return (
                <Link
                  to={`/catalog?make=${encodeURIComponent(b.slug)}`}
                  key={b.slug}
                  className={`${styles.brandItem} reveal reveal--fade-up`}
                  aria-label={T.browse(b.name)}
                  data-testid={`brand-logo-${b.slug}`}
                  data-row={Math.floor(i / 6)}
                  style={{ animationDelay: `${delayIdx * 80}ms` }}
                >
                  <img
                    className={styles.brandLogo}
                    src={b.src}
                    alt={b.name}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      if (e.currentTarget.nextSibling) {
                        e.currentTarget.nextSibling.style.display = "inline";
                      }
                    }}
                  />
                  <span className={styles.brandFallback}>{b.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Counter pill — "12 / 51 brands shown" */}
          <div className={styles.brandsMeta}>
            {visible} <span className={styles.brandsMetaDim}>/ {total} {T.brandsLabel}</span>
          </div>
        </div>

        <div className={styles.otherBrands}>
          {showAllBtn ? (
            <button
              type="button"
              className={styles.otherBrands2}
              onClick={handleMore}
              data-testid="brands-show-more"
            >
              {T.otherBrands}
            </button>
          ) : !collapsed ? (
            <button
              type="button"
              className={styles.otherBrands2}
              onClick={handleHide}
              data-testid="brands-hide"
            >
              {T.hideBrands}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default BrandLogos1;
