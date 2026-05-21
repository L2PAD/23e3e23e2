/**
 * SystemPage — Unified hub for all system configuration.
 *
 * Replaces three previously separate sidebar entries:
 *   • System         (CRM / Security)
 *   • Auth & URLs    (base URL, OAuth, JWT, password policy, feature flags)
 *   • Email Outbox   (sent email log)
 *
 * Single page, tabbed UX. Sub-pages are reused as-is via composition,
 * so all existing logic (PATCH endpoints, polling, etc.) keeps working.
 *
 * Active tab is reflected in the URL via ?tab= so deep-links and the
 * legacy redirects from /admin/settings/auth and /admin/settings/email-outbox
 * still land on the right sub-section.
 */
import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Wrench,
  ShieldCheck,
  Link as LinkIcon,
  EnvelopeSimple,
} from '@phosphor-icons/react';

import AdminSettingsPage from './AdminSettingsPage';
import AuthSettingsPage from './AuthSettingsPage';
import EmailOutboxPage from './EmailOutboxPage';

import { useLang } from '../../i18n';
const TABS = [
  { id: 'general',  label: 'General',     icon: Wrench,         description: 'CRM pipelines, business logic' },
  { id: 'auth',     label: 'Auth & URLs',  icon: ShieldCheck,    description: 'baseUrl, Google OAuth, JWT, password policy' },
  { id: 'email',    label: 'Email outbox', icon: EnvelopeSimple, description: 'Sent emails log' },
];

export default function SystemPage() {
  const { t } = useLang();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(() => {
    const search = new URLSearchParams(location.search);
    const t = search.get('tab') || 'general';
    return TABS.find((x) => x.id === t) ? t : 'general';
  }, [location.search]);

  const setTab = (id) => {
    const search = new URLSearchParams(location.search);
    search.set('tab', id);
    navigate({ pathname: '/admin/settings', search: search.toString() }, { replace: false });
  };

  return (
    <div className="min-h-full bg-[#FAFAFA]">
      {/* ────────────── Header ────────────── */}
      <div className="px-6 pt-6 pb-4 bg-white border-b border-[#E4E4E7]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-[#18181B] text-white flex items-center justify-center">
              <Wrench size={18} weight="regular" />
            </div>
            <h1 className="text-[22px] font-semibold tracking-tight text-[#18181B]">{t('notifSystem')}</h1>
          </div>
          <p className="text-[13px] text-[#71717A] ml-12">
            {t('adm3_7cc60ff3e9')}
          </p>

          {/* ────────────── Tabs ────────────── */}
          <div className="mt-5 -mb-px flex gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  data-testid={`system-tab-${t.id}`}
                  className={[
                    'group inline-flex items-center gap-2 px-4 py-2.5 text-[13px] rounded-t-lg transition-colors',
                    active
                      ? 'bg-[#FAFAFA] text-[#18181B] border-l border-r border-t border-[#E4E4E7] font-medium'
                      : 'text-[#71717A] hover:text-[#18181B] font-normal',
                  ].join(' ')}
                  style={active ? { marginBottom: '-1px', borderBottom: '1px solid #FAFAFA' } : undefined}
                >
                  <Icon size={15} weight={active ? 'fill' : 'regular'} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ────────────── Content ────────────── */}
      <div className="px-6 py-6">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'general' && <AdminSettingsPage embedded />}
          {activeTab === 'auth'    && <AuthSettingsPage    embedded />}
          {activeTab === 'email'   && <EmailOutboxPage     embedded />}
        </div>
      </div>
    </div>
  );
}
