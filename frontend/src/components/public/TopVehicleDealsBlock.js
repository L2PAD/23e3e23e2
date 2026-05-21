/**
 * TopVehicleDealsBlock — "Top vehicles deals of the week".
 *
 * 4-card grid of the editor-picked vehicles with a left-side bracketed
 * tagline.  Matches the Figma reference exactly:
 *   • Title with white + amber color split
 *   • Subhead inside Figma-style brackets
 *   • Cards: image with auction countdown chip, model, price/mileage/engine/drive
 *     mini grid, estimated cost, and an amber "More details" CTA.
 *   • Bottom row: "more vehicles +" link.
 *
 * Data here is mock placeholder copy keyed off real public catalog
 * structure — swap to backend /api/public/catalog/featured later.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from '@phosphor-icons/react';

const CARS = [
  {
    id: 1,
    name: '2025 Lucid Motors Air Pure',
    img: 'https://images.unsplash.com/photo-1617469767053-94de1ea0a18b?auto=format&fit=crop&w=1200&q=80',
    timer: '1d. 4h. 35m.',
    price: '20,000-30,000 EURO',
    mileage: '65 900 KM',
    engine: '2.0L Hybrid',
    drive: 'AWD',
    finalCost: '50,000-70,000 EURO',
  },
  {
    id: 2,
    name: '2024 BMW M5 Competition',
    img: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80',
    timer: '0d. 12h. 02m.',
    price: '45,000-55,000 EURO',
    mileage: '12 400 KM',
    engine: '4.4L V8 Twin-Turbo',
    drive: 'AWD',
    finalCost: '78,000-92,000 EURO',
  },
  {
    id: 3,
    name: '2023 Mercedes-AMG GT 63',
    img: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80',
    timer: '2d. 6h. 11m.',
    price: '60,000-72,000 EURO',
    mileage: '8 100 KM',
    engine: '4.0L V8 Bi-Turbo',
    drive: 'AWD',
    finalCost: '110,000-130,000 EURO',
  },
  {
    id: 4,
    name: '2024 Tesla Model S Plaid',
    img: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1200&q=80',
    timer: '0d. 4h. 50m.',
    price: '55,000-65,000 EURO',
    mileage: '4 200 KM',
    engine: 'Triple-Motor EV',
    drive: 'AWD',
    finalCost: '95,000-115,000 EURO',
  },
];

const Card = ({ car }) => (
  <article
    className="flex flex-col bg-[#0a0a0a] border border-[#1d1d1d] rounded-md overflow-hidden hover:border-[#FEAE00]/60 transition-colors group"
    data-testid={`top-deal-${car.id}`}
  >
    {/* Image */}
    <div className="relative aspect-[16/10] overflow-hidden bg-[#111]">
      <img
        src={car.img}
        alt={car.name}
        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
        loading="lazy"
      />
      {/* Auction countdown chip */}
      <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-black/85 backdrop-blur px-3 py-1 rounded-full text-white text-[12px]">
        <Clock size={14} weight="regular" className="text-[#FEAE00]" />
        {car.timer}
      </div>
    </div>

    {/* Body */}
    <div className="p-5 flex flex-col flex-1">
      <h3 className="text-white text-[20px] font-semibold leading-tight tracking-tight">
        {car.name}
      </h3>

      {/* 4 spec rows */}
      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2.5 text-[13px]">
        <div>
          <dt className="text-[#9a9a98]">Purchase price</dt>
          <dd className="text-white font-medium mt-0.5">{car.price}</dd>
        </div>
        <div>
          <dt className="text-[#9a9a98]">Mileage</dt>
          <dd className="text-white font-medium mt-0.5">{car.mileage}</dd>
        </div>
        <div>
          <dt className="text-[#9a9a98]">Engine</dt>
          <dd className="text-white font-medium mt-0.5">{car.engine}</dd>
        </div>
        <div>
          <dt className="text-[#9a9a98]">Drive</dt>
          <dd className="text-white font-medium mt-0.5">{car.drive}</dd>
        </div>
      </dl>

      {/* Estimated final cost */}
      <div className="mt-5 pt-4 border-t border-[#1d1d1d]">
        <div className="text-[12px] text-[#9a9a98]">Estimated final cost to Bulgaria</div>
        <div className="text-[#FEAE00] text-[18px] font-semibold mt-1 tracking-tight">
          {car.finalCost}
        </div>
      </div>

      {/* CTA */}
      <Link
        to="/contacts"
        className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-5 bg-[#FEAE00] hover:bg-[#FFBF2D] active:bg-[#E89D00] text-black text-[13px] font-medium uppercase tracking-[0.06em] rounded transition-colors"
      >
        More details
        <ArrowRight size={14} weight="bold" />
      </Link>
    </div>
  </article>
);

export default function TopVehicleDealsBlock() {
  return (
    <section className="bg-black text-white py-16" data-testid="top-vehicle-deals">
      <div className="max-w-[1920px] mx-auto px-6 lg:px-[100px]">
        {/* Heading row */}
        <div className="flex items-end justify-between flex-wrap gap-x-12 gap-y-6 mb-10">
          <h2
            className="font-[Mazzard] font-bold tracking-tight"
            style={{ fontSize: 'clamp(34px, 4.4vw, 72px)', lineHeight: 1.02, letterSpacing: '-0.01em' }}
          >
            <span className="text-white">Top vehicles deals </span>
            <span className="text-[#FEAE00]">of the week</span>
          </h2>
          <p className="text-[15px] text-white/70 max-w-md leading-relaxed">
            <span className="text-[#FEAE00] mr-1">[</span>
            Thousands of listings. Only the best make the cut. Updated weekly
            <span className="text-[#FEAE00] ml-1">]</span>
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {CARS.map((c) => <Card key={c.id} car={c} />)}
        </div>

        {/* More vehicles link */}
        <div className="mt-12 text-center">
          <Link
            to="/catalog"
            className="inline-flex items-center gap-2 text-[18px] uppercase tracking-[0.08em] text-white hover:text-[#FEAE00] transition-colors"
          >
            more vehicles
            <span className="text-[#FEAE00] text-[24px] leading-none">+</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
