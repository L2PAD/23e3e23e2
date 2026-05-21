import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { 
  ChartBar, 
  Eye, 
  Users, 
  MagnifyingGlass,
  UserPlus,
  Handshake,
  Percent,
  ArrowsClockwise,
  Warning
} from '@phosphor-icons/react';
import { useLang } from '../i18n';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Status Badge Component
const StatusBadge = ({ status }) => {
  const colors = {
    scale: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    keep: 'bg-blue-100 text-blue-700 border-blue-200',
    watch: 'bg-amber-100 text-amber-700 border-amber-200',
    kill: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${colors[status] || colors.watch}`}>
      {status?.toUpperCase()}
    </span>
  );
};

// KPI Card Component
const KPICard = ({ title, value, icon, trend, color = 'blue' }) => {
  const iconColors = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    yellow: 'text-amber-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
  };

  return (
    <div className="kpi-card">
      <div className="mb-4">
        <span className={iconColors[color]}>{icon}</span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{title}</div>
      {trend && (
        <p className={`text-xs mt-1 ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
        </p>
      )}
    </div>
  );
};

// Funnel Component
const FunnelChart = ({ data }) => {
  const { t } = useLang();
  if (!data?.steps) return null;

  const maxValue = Math.max(...data.steps.map(s => s.value));

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold mb-4">{t('i18n_conversion_funnel_417423')}</h3>
      <div className="space-y-3">
        {data.steps.map((step, idx) => (
          <div key={step.name} className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{step.name}</span>
              <span className="text-sm text-gray-500">
                {step.value.toLocaleString()} ({step.rate}%)
              </span>
            </div>
            <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-lg transition-all"
                style={{ width: `${(step.value / maxValue) * 100}%` }}
              />
            </div>
            {idx < data.steps.length - 1 && (
              <div className="text-center text-xs text-gray-400 py-1">↓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Sources Table Component
const SourcesTable = ({ data }) => {
  const { t } = useLang();
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">{t('i18n_traffic_sources_f8f6bb')}</h3>
        <p className="text-gray-500">{t('i18n_no_data_ab3015')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold mb-4">{t('i18n_traffic_sources_and_roi_0c15e6')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">{t('i18n_source_0945d8')}</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">{t('i18n_visits_e737a8')}</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">{t('i18n_leads_70641b')}</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">{t('i18n_deals_3bbd14')}</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">{t('i18n_profit_123a87')}</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">CR</th>
            </tr>
          </thead>
          <tbody>
            {data.map((source, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-2 font-medium">{source.source || 'Direct'}</td>
                <td className="py-3 px-2 text-right">{source.visits?.toLocaleString()}</td>
                <td className="py-3 px-2 text-right">{source.leads}</td>
                <td className="py-3 px-2 text-right">{source.deals}</td>
                <td className="py-3 px-2 text-right">${source.profit?.toLocaleString()}</td>
                <td className={`py-3 px-2 text-right font-semibold ${
                  source.conversion > 5 ? 'text-emerald-600' :
                  source.conversion > 2 ? 'text-blue-600' :
                  source.conversion > 0 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {source.conversion?.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Campaign Optimizer Component
const CampaignOptimizer = ({ data }) => {
  const { t } = useLang();
  if (!data?.decisions || data.decisions.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">{t('i18n_campaign_optimizer_180c32')}</h3>
        <p className="text-gray-500">{t('i18n_no_campaign_data_dccdf9')}</p>
      </div>
    );
  }

  const { decisions, summary } = data;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{t('i18n_campaign_optimizer_180c32')}</h3>
        <div className="flex gap-2">
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">
            {summary.scaleCount} {t('i18n_scale_0883ab')}
          </span>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
            {summary.keepCount} {t('i18n_keep_3d4a3f')}
          </span>
          <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
            {summary.watchCount} {t('i18n_watch_5c91a0')}
          </span>
          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
            {summary.killCount} {t('i18n_stop_5d9160')}
          </span>
        </div>
      </div>

      {summary.recommendations?.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm font-medium text-blue-800">{t('i18n_quick_actions_c82775')}</p>
          <ul className="mt-1 text-sm text-blue-700">
            {summary.recommendations.map((rec, idx) => (
              <li key={idx}>• {rec}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">{t('i18n_campaign_15b3d1')}</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">{t('i18n_expenses_1ceb39')}</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">{t('i18n_leads_70641b')}</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">{t('i18n_deals_3bbd14')}</th>
              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">ROI</th>
              <th className="text-center py-3 px-2 text-sm font-semibold text-gray-600">{t('i18n_status_7203f7')}</th>
              <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">{t('i18n_action_773c46')}</th>
            </tr>
          </thead>
          <tbody>
            {decisions.slice(0, 10).map((campaign, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-2">
                  <div className="font-medium">{campaign.campaign}</div>
                  <div className="text-xs text-gray-500">{campaign.source}</div>
                </td>
                <td className="py-3 px-2 text-right">${campaign.spend?.toLocaleString()}</td>
                <td className="py-3 px-2 text-right">{campaign.leads}</td>
                <td className="py-3 px-2 text-right">{campaign.deals}</td>
                <td className={`py-3 px-2 text-right font-semibold ${
                  campaign.roi > 30 ? 'text-emerald-600' :
                  campaign.roi > 0 ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {campaign.roi?.toFixed(1)}%
                </td>
                <td className="py-3 px-2 text-center">
                  <StatusBadge status={campaign.status} />
                </td>
                <td className="py-3 px-2">
                  <div className="text-xs text-gray-600 max-w-[200px]">
                    {campaign.actions?.[0]}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Fake Traffic Alert Component
const FakeTrafficAlert = ({ data }) => {
  const { t } = useLang();
  if (!data || data.count === 0) return null;

  return (
    <div className="bg-red-50 rounded-xl p-4 border border-red-100">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-lg">
          <Warning size={20} weight="duotone" className="text-red-600" />
        </div>
        <div>
          <p className="font-semibold text-red-800">{t('i18n_fake_traffic_detected_04251b')}</p>
          <p className="text-sm text-red-600">
            {data.count} {t('i18n_suspicious_sessions_8bfbe5')} ({data.percentage}% {t('i18n_traffic_561df4')})
          </p>
        </div>
      </div>
    </div>
  );
};

// Main Analytics Dashboard Component
const AdminAnalyticsDashboard = () => {
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [dashboard, setDashboard] = useState(null);
  const [marketing, setMarketing] = useState(null);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [dashboardRes, marketingRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/dashboard?days=${days}`).then(r => r.json()),
        fetch(`${API_URL}/api/marketing/campaigns?days=${days}`).then(r => r.json()),
      ]);

      if (dashboardRes.success) setDashboard(dashboardRes.data);
      if (marketingRes.success) setMarketing(marketingRes.data);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-3 text-gray-600">{t('i18n_loading_analytics_168307')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-red-600">
          <p>{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {t('i18n_retry_0da390')}
          </button>
        </div>
      </div>
    );
  }

  const kpi = dashboard?.kpi || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Mazzard, Mazzard H, Mazzard M, system-ui, sans-serif' }}>
            {t('i18n_analytics_dashboard_28f116')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('i18n_marketing_performance_and_roi_ab828b')}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>{t('i18n_last_7_days_79531d')}</option>
            <option value={14}>{t('i18n_last_14_days_a937d9')}</option>
            <option value={30}>{t('i18n_last_30_days_f5c99e')}</option>
            <option value={60}>{t('i18n_last_60_days_226c39')}</option>
            <option value={90}>{t('i18n_last_90_days_f1b762')}</option>
          </select>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {t('i18n_refresh_b6bf91')}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Fake Traffic Alert */}
        {dashboard?.fakeTraffic && (
          <FakeTrafficAlert data={dashboard.fakeTraffic} />
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard
            title={t('i18n_visits_e737a8')}
            value={kpi.visits?.toLocaleString() || '0'}
            color="blue"
            icon={<Eye size={24} weight="duotone" />}
          />
          <KPICard
            title={t('i18n_unique_sessions_71b5b5')}
            value={kpi.uniqueSessions?.toLocaleString() || '0'}
            color="purple"
            icon={<Users size={24} weight="duotone" />}
          />
          <KPICard
            title={t('i18n_vin_searches_3ff096')}
            value={kpi.vinSearches?.toLocaleString() || '0'}
            color="blue"
            icon={<MagnifyingGlass size={24} weight="duotone" />}
          />
          <KPICard
            title={t('i18n_leads_70641b')}
            value={kpi.leads?.toLocaleString() || '0'}
            color="yellow"
            icon={<UserPlus size={24} weight="duotone" />}
          />
          <KPICard
            title={t('i18n_deals_3bbd14')}
            value={kpi.deals?.toLocaleString() || '0'}
            color="green"
            icon={<Handshake size={24} weight="duotone" />}
          />
          <KPICard
            title={t('i18n_conversion_b7e8aa')}
            value={`${kpi.conversion?.toFixed(2) || '0'}%`}
            color={kpi.conversion > 5 ? 'green' : kpi.conversion > 2 ? 'yellow' : 'red'}
            icon={<Percent size={24} weight="duotone" />}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Funnel */}
          <FunnelChart data={dashboard?.funnel} />

          {/* Sources */}
          <SourcesTable data={dashboard?.sources} />
        </div>

        {/* Campaign Optimizer - Full Width */}
        <CampaignOptimizer data={marketing} />

        {/* Timeline Chart */}
        {dashboard?.timeline && dashboard.timeline.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">{t('i18n_traffic_chart_625043')}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dashboard.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="_id" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  name={t('i18n_events_424ddb')}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalyticsDashboard;
