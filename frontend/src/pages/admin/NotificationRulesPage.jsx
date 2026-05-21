/**
 * Master-Admin  →  Notification Rules
 * Toggle each event on/off. For each event decide which audiences receive
 * it and through which channels. Simple, declarative.
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useLang } from '../../i18n';
import {
  Bell,
  RefreshCw,
  Save,
  Mail,
  Smartphone,
  ToggleLeft,
  ToggleRight,
  Play,
  Users,
  UserCircle,
  Shield,
  Crown,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const EVENT_LABEL = {
  invoice_sent:      'Invoice sent to client',
  payment_confirmed: 'Payment confirmed',
  order_started:     'Order launched',
  order_finished:    'Order completed',
  payment_reminder:  'Payment reminder',
};

const AUDIENCE = {
  customer:     { labelKey: 'customer',         icon: UserCircle, color: '#2563EB' },
  manager:      { labelKey: 'roleManager',      icon: Users,      color: '#7C3AED' },
  team_lead:    { labelKey: 'roleTeamLead',     icon: Shield,     color: '#D97706' },
  master_admin: { labelKey: 'roleMasterAdmin',  icon: Crown,      color: '#18181B' },
};

const CHANNELS = {
  email:  { labelKey: 'emailLabel',  icon: Mail },
  in_app: { labelKey: 'inAppChannel', icon: Bell },
};

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function NotificationRulesPage() {
  const { t } = useLang();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/api/admin/notification-rules`, { headers: authHeaders() });
      setRules(r.data?.items || []);
    } catch {
      toast.error(t('loadingError'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveRule = async (event, patch) => {
    try {
      const r = await axios.patch(`${API_URL}/api/admin/notification-rules/${event}`, patch, { headers: authHeaders() });
      setRules((prev) => prev.map((x) => (x.event === event ? r.data.rule : x)));
      toast.success(t('saved'));
    } catch (e) {
      toast.error(e.response?.data?.detail || t('adm2_fd77287f02'));
    }
  };

  const toggleEnabled = async (rule) => {
    await saveRule(rule.event, { enabled: !rule.enabled, targets: rule.targets || [] });
  };

  const toggleChannel = async (rule, audience, channel) => {
    const targets = [...(rule.targets || [])];
    let target = targets.find((t) => t.audience === audience);
    if (!target) {
      targets.push({ audience, channels: [channel] });
    } else {
      const has = target.channels.includes(channel);
      target.channels = has ? target.channels.filter((c) => c !== channel) : [...target.channels, channel];
      if (target.channels.length === 0) {
        // drop empty target
        const idx = targets.indexOf(target);
        targets.splice(idx, 1);
      }
    }
    await saveRule(rule.event, { enabled: rule.enabled, targets });
  };

  const testDispatch = async (event) => {
    setTesting(event);
    try {
      const r = await axios.post(`${API_URL}/api/admin/notifications/test-dispatch`, { event }, { headers: authHeaders() });
      toast.success(`${t('r9_sent')} · ${t('r9_recipients_label')}: ${r.data?.dispatch?.total || 0}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || t('adm2_fd77287f02'));
    } finally {
      setTesting('');
    }
  };

  const hasChannel = (rule, audience, channel) => {
    const t = (rule.targets || []).find((x) => x.audience === audience);
    return !!t && t.channels.includes(channel);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Bell className="w-7 h-7 text-[#635BFF]" /> {t('adm_notification_settings')}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {t('adm_for_each_business_event_choose_who_receives_notifi')}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('adm_refresh_3')}
        </button>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => (
          <div key={rule.event} className={`bg-white border rounded-2xl overflow-hidden ${rule.enabled ? 'border-zinc-200' : 'border-zinc-100 opacity-70'}`}>
            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-400 font-mono">{rule.event}</p>
                <p className="text-lg font-semibold text-zinc-900">{EVENT_LABEL[rule.event] || rule.event}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => testDispatch(rule.event)}
                  disabled={testing === rule.event || !rule.enabled}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" /> {t('adm_test')}
                </button>
                <button
                  onClick={() => toggleEnabled(rule)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    background: rule.enabled ? '#10B98115' : '#71717A15',
                    color: rule.enabled ? '#047857' : '#52525B',
                  }}
                >
                  {rule.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {rule.enabled ? t('adm2_26841eb416') : t('adm2_7e9d3ee2f5')}
                </button>
              </div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(AUDIENCE).map(([audKey, aud]) => {
                  const Icon = aud.icon;
                  return (
                    <div key={audKey} className="p-3 rounded-xl border border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${aud.color}15` }}>
                          <Icon className="w-4 h-4" style={{ color: aud.color }} />
                        </div>
                        <p className="text-sm font-medium text-zinc-800">{t(aud.labelKey)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {Object.entries(CHANNELS).map(([chKey, ch]) => {
                          const ChIcon = ch.icon;
                          const active = hasChannel(rule, audKey, chKey);
                          return (
                            <button
                              key={chKey}
                              onClick={() => toggleChannel(rule, audKey, chKey)}
                              disabled={!rule.enabled}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                                active
                                  ? 'bg-[#635BFF] text-white'
                                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                              }`}
                              title={t(ch.labelKey)}
                            >
                              <ChIcon className="w-3.5 h-3.5" /> {t(ch.labelKey)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        {rules.length === 0 && !loading && (
          <div className="text-center py-12 text-zinc-400 text-sm bg-white border border-dashed border-zinc-200 rounded-2xl">
            {t('adm_no_rules_found')}
          </div>
        )}
      </div>
    </div>
  );
}
