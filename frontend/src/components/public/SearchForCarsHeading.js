/**
 * SearchForCarsHeading — 1–1 port of Figma reference (BIBICARS 5.zip)
 *
 *   File:      app/homepage1.module.css  .catalogAction + .carSearch + .searchForCars + .fromAmericaAnd
 *   Font:      Mazzard, weight 400, line-height 100%, uppercase
 *   Sizes:     60px (orange line) / 50px (white line)
 *   Layout:    centered column, 694px max, 13px gap, 120.5px bottom padding
 */
import React from 'react';

export default function SearchForCarsHeading() {
  return (
    <section
      data-testid="search-for-cars-heading"
      style={{
        alignSelf: 'stretch',
        display: 'flex',
        justifyContent: 'center',
        padding: '0 20px 120.5px',
        boxSizing: 'border-box',
        textAlign: 'center',
        fontFamily: 'Mazzard, "Mazzard H", system-ui, sans-serif',
        backgroundColor: '#000',
      }}
    >
      <div
        style={{
          width: 694,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 13,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'inherit',
            fontWeight: 400,
            fontSize: 60,
            lineHeight: '100%',
            textTransform: 'uppercase',
            color: '#FEAE00',
            whiteSpace: 'nowrap',
          }}
        >
          Search for cars
        </h2>
        <h2
          style={{
            margin: 0,
            fontFamily: 'inherit',
            fontWeight: 400,
            fontSize: 50,
            lineHeight: '100%',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            whiteSpace: 'nowrap',
          }}
        >
          from America and Korea
        </h2>
      </div>

      {/* Responsive tweaks copied from homepage1.module.css */}
      <style>{`
        @media (max-width: 925px) {
          [data-testid="search-for-cars-heading"] > div { padding: 0 33px; box-sizing: border-box; }
          [data-testid="search-for-cars-heading"] h2:first-child { font-size: 48px !important; line-height: 100% !important; }
          [data-testid="search-for-cars-heading"] h2:last-child  { font-size: 40px !important; line-height: 100% !important; }
        }
        @media (max-width: 450px) {
          [data-testid="search-for-cars-heading"] h2:first-child { font-size: 36px !important; }
          [data-testid="search-for-cars-heading"] h2:last-child  { font-size: 30px !important; }
        }
      `}</style>
    </section>
  );
}
