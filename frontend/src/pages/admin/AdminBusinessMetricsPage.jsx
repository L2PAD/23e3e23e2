/**
 * Admin Business Metrics
 *
 *   /admin/business-metrics
 *
 * Shows exactly 3 KPIs requested by product spec:
 *   - conversion     (paid invoices / sent invoices)
 *   - avg_order_time (avg hours between order created_at → completedAt)
 *   - repeat_rate    (customers with 2+ orders / total customers)
 *
 * Data comes from GET /api/admin/metrics.
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLang } from '../../i18n';
import {
  ChartLine,
  CurrencyCircleDollar,
  Clock,
  ArrowsClockwise,
  UsersThree,
  ArrowClockwise,
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const fmtPct = (v) =>
  v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`;
const fmtHours = (v) => {
  if (v === null || v === undefined) return '—';
  if (v < 1) return `${Math.round(v * 60)} ${t('r9_min_short')}`;
  if (v < 24) return `${v.toFixed(1)} ${t('r9_h_short')}`;
  return `${(v / 24).toFixed(1)} ${t('r9_days_short')}`;
};

const MetricCard = ({ icon: Icon, title, value, subtitle, color = 'indigo' }) => {
  const palette = {
    indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  }[color];
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm" data-testid={`metric-card-${color}`}>
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-xl ring-1 ${palette}`}>
          <Icon size={24} weight="bold" />
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-4xl font-bold text-zinc-900 tracking-tight" data-testid={`metric-value-${color}`}>{value}</h3>
        <p className="text-sm font-medium text-zinc-600 mt-2">{title}</p>
        {subtitle && <p className="text-xs text-zinc-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

export default function AdminBusinessMetricsPage() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const r = await axios.get(`${API_URL}/api/admin/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(r.data);
    } catch (e) {
      console.error(e);
      toast.error(t('metricsLoadFail'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const t = setInterval(fetchMetrics, 60 * 1000); // refresh every minute
    return () => clearInterval(t);
  }, [fetchMetrics]);

  const m = data?.metrics;

  return (
    <div className="space-y-6" data-testid="admin-business-metrics-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <ChartLine size={28} weight="bold" className="text-indigo-600" />
            {t('adm_business_metrics')}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {t('adm_three_key_management_metrics_conversion_execution')}
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-sm font-medium text-zinc-700 disabled:opacity-50"
          data-testid="metrics-refresh-btn"
        >
          <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} />
          {t('adm_refresh_3')}
        </button>
      </div>

      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-zinc-200 p-6 h-40 animate-pulse"
            />
          ))}
        </div>
      )}

      {m && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              icon={CurrencyCircleDollar}
              title={t('invoiceConv')}
              value={fmtPct(m.conversion?.value)}
              subtitle={`${m.conversion?.paid ?? 0} ${t('adm_paid_of')} ${m.conversion?.sent ?? 0} ${t('adm_sent')}`}
              color="emerald"
            />
            <MetricCard
              icon={Clock}
              title={t('avgCompletionTime')}
              value={fmtHours(m.avg_order_time?.value_hours)}
              subtitle={`${t('adm_over')} ${m.avg_order_time?.completed_orders ?? 0} ${t('adm_completed_orders')}`}
              color="indigo"
            />
            <MetricCard
              icon={UsersThree}
              title={t('clientRepeat')}
              value={fmtPct(m.repeat_rate?.value)}
              subtitle={`${m.repeat_rate?.repeat_customers ?? 0} ${t('adm_repeat_of')} ${m.repeat_rate?.total_customers ?? 0} ${t('adm_customers')}`}
              color="amber"
            />
          </div>

          <div className="mt-8 text-xs text-zinc-400">
            {t('updated')}: {new Date(data.generated_at).toLocaleString()}
          </div>

          <div className="mt-2 bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-500 leading-relaxed">
            <div><b>{t('conversion')}</b> {t('adm2_paid_invoices_sent_invo_17ac8c0000')}</div>
            <div><b>{t('avgOrderTime')}</b> {t('adm2_completedat_created_at_685e4b6248')} <code>completed</code>.</div>
            <div><b>{t('repeatRate')}</b> {t('adm2_2_67b5fa1733')}</div>
          </div>
        </>
      )}
    </div>
  );
}
