/**
 * Admin Provider Pressure / Health Dashboard
 *
 *   /admin/provider-health
 *
 * Shows every manager's Provider Pressure score (0-100), tier, and
 * component sub-scores. Drives matching / visibility / boosts.
 *
 * Backend:
 *   GET  /api/admin/providers/stats
 *   POST /api/admin/providers/stats/recompute
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLang } from '../../i18n';
import {
  Gauge,
  ArrowClockwise,
  Fire,
  ShieldCheck,
  Warning,
  EyeSlash,
  Lightning,
  Clock,
  CheckCircle,
  UsersThree,
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const TIER_META = {
  high:      { label: 'High',      emoji: '🟢', color: 'bg-emerald-100 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500', multiplier: '×1.2' },
  normal:    { label: 'Normal',    emoji: '🟡', color: 'bg-amber-100 text-amber-700 ring-amber-200',       bar: 'bg-amber-500',   multiplier: '×1.0' },
  warning:   { label: 'Warning',   emoji: '🟠', color: 'bg-orange-100 text-orange-700 ring-orange-200',    bar: 'bg-orange-500',  multiplier: '×0.8' },
  penalized: { label: 'Penalized', emoji: '🔴', color: 'bg-red-100 text-red-700 ring-red-200',             bar: 'bg-red-500',     multiplier: '×0.5' },
  hidden:    { label: 'Hidden',    emoji: '🚫', color: 'bg-zinc-200 text-zinc-700 ring-zinc-300',           bar: 'bg-zinc-500',    multiplier: 'excl.' },
};

const pct = (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(0)}%`);
const fmt = (v, unit) => (v === null || v === undefined ? '—' : `${v} ${unit}`);

const TierBadge = ({ tier }) => {
  const meta = TIER_META[tier] || TIER_META.normal;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${meta.color}`}
      data-testid={`tier-badge-${tier}`}
    >
      <span>{meta.emoji}</span>
      {meta.label}
      <span className="text-[10px] opacity-70 ml-1">{meta.multiplier}</span>
    </span>
  );
};

const ScoreBar = ({ score, tier }) => {
  const meta = TIER_META[tier] || TIER_META.normal;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs font-medium text-zinc-500 mb-1">
        <span>0</span>
        <span className="text-zinc-900 text-base font-bold">{score}</span>
        <span>100</span>
      </div>
      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full ${meta.bar} transition-all duration-500`} style={{ width: `${Math.max(2, score)}%` }} />
      </div>
    </div>
  );
};

export default function ProviderHealthPage() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const r = await axios.get(`${API_URL}/api/admin/providers/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(r.data.items || []);
    } catch (e) {
      console.error(e);
      toast.error(t('adm_failed_to_load_health_dashboard'));
    } finally {
      setLoading(false);
    }
  }, []);

  const recomputeAll = useCallback(async () => {
    setRecomputing(true);
    try {
      const token = localStorage.getItem('token');
      const r = await axios.post(
        `${API_URL}/api/admin/providers/stats/recompute`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${t('r9_recalculated')} ${r.data?.count ?? 0} ${t('r9_providers_plural')}`);
      await load();
    } catch (e) {
      console.error(e);
      toast.error(t('adm_recalculation_failed'));
    } finally {
      setRecomputing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  const tierCounts = useMemo(() => {
    const acc = { high: 0, normal: 0, warning: 0, penalized: 0, hidden: 0 };
    for (const it of items) {
      if (acc[it.tier] !== undefined) acc[it.tier] += 1;
    }
    return acc;
  }, [items]);

  return (
    <div className="space-y-6" data-testid="provider-health-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Gauge size={28} weight="bold" className="text-indigo-600" />
            {t('adm_provider_pressure_healthscore')}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {t('adm_performer_rating_controls_matching_visibility_boos')}
          </p>
        </div>
        <button
          onClick={recomputeAll}
          disabled={recomputing || loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50"
          data-testid="provider-recompute-btn"
        >
          <ArrowClockwise size={16} className={recomputing ? 'animate-spin' : ''} />
          {recomputing ? t('adm2_3038223bb4') : t('adm2_98a263e7c7')}
        </button>
      </div>

      {/* Tier distribution summary */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {Object.entries(TIER_META).map(([key, meta]) => (
          <div key={key} className={`rounded-xl p-4 ring-1 ${meta.color}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide">
                {meta.emoji} {meta.label}
              </span>
              <span className="text-xs opacity-70">{meta.multiplier}</span>
            </div>
            <div className="mt-1 text-2xl font-bold">{tierCounts[key] ?? 0}</div>
          </div>
        ))}
      </div>

      {/* Provider table */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3">{t('adm_assignee')}</th>
                <th className="px-4 py-3 w-48">{t('scoreLabel')}</th>
                <th className="px-4 py-3">{t('tierLabel')}</th>
                <th className="px-4 py-3">{t('responseLabel')}</th>
                <th className="px-4 py-3">{t('completionLabel')}</th>
                <th className="px-4 py-3">{t('activityLabel')}</th>
                <th className="px-4 py-3">{t('adm_orders')}</th>
                <th className="px-4 py-3">{t('lateStarts')}</th>
                <th className="px-4 py-3">{t('adm_updated')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-zinc-400">{t('adm_loading_3')}</td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-zinc-400">
                    {t('adm_no_provider_create_an_invoice_and_mark_it_as_paid')}
                  </td>
                </tr>
              )}
              {items.map((it) => (
                <tr key={it.providerId} className="hover:bg-zinc-50" data-testid={`provider-row-${it.providerId}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900">{it.providerName || it.providerId}</div>
                    <div className="text-xs text-zinc-400">{it.providerEmail || it.providerId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBar score={it.score || 0} tier={it.tier} />
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={it.tier} />
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    <div className="font-medium">{pct(it.sub_scores?.responseScore)}</div>
                    <div className="text-xs text-zinc-400">{it.metrics?.responseTimeAvg ? `${it.metrics.responseTimeAvg} ${t('r9_min_short')}` : '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    <div className="font-medium">{pct(it.sub_scores?.completionScore)}</div>
                    <div className="text-xs text-zinc-400">{it.metrics?.completedOrders ?? 0}/{it.metrics?.totalOrders ?? 0}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{pct(it.sub_scores?.activityScore)}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    <span className="font-medium">{it.metrics?.activeOrders ?? 0}</span>
                    <span className="text-xs text-zinc-400"> / {it.metrics?.totalOrders ?? 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    {(it.penalties?.lateStarts ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                        <Warning size={14} weight="bold" />
                        {it.penalties.lateStarts}
                      </span>
                    ) : (
                      <span className="text-zinc-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {it.updatedAt ? new Date(it.updatedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-600 leading-relaxed">
        <div className="font-semibold text-zinc-700 mb-2">{t('adm_how_it_works')}</div>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Score 80–100 (High)</b> {t('adm_boost_12_in_matching_priority_delivery_of_new_orde')}</li>
          <li><b>60–79 (Normal)</b> {t('adm_normal_output_multiplier_10')}</li>
          <li><b>40–59 (Warning)</b> {t('adm_multiplier_08_manager_receives_a_notification_you')}</li>
          <li><b>20–39 (Penalized)</b> {t('adm_multiplier_05_penalty_close_to_disabling')}</li>
          <li><b>&lt; 20 (Hidden)</b> {t('adm_excluded_from_matching_can_be_returned_by_recalcul')}</li>
        </ul>
        <div className="mt-2">{t('adm_tier_change_notifications_are_sent_to_the_manager')}</div>
      </div>
    </div>
  );
}
