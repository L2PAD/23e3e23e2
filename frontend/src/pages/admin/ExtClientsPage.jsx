/**
 * ExtClientsPage — per-manager extension HMAC secrets registry (Phase E)
 *
 * Manager wants: know which devices are allowed to sign Chrome-extension
 * traffic, rotate their secret, or instantly revoke a compromised one.
 *
 * Endpoints:
 *   GET  /api/admin/ext-clients
 *   POST /api/admin/ext-clients              body: {name, managerEmail?}
 *   POST /api/admin/ext-clients/{id}/revoke
 *   POST /api/admin/ext-clients/{id}/rotate
 *
 * Secret is shown ONLY on create/rotate (write-once).
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

import { useLang } from '../../i18n';
const API =
  process.env.REACT_APP_BACKEND_URL ||
  import.meta?.env?.REACT_APP_BACKEND_URL ||
  '';

function authHeaders() {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ExtClientsPage() {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', managerEmail: '' });
  const [secretShow, setSecretShow] = useState(null); // {clientId, secret}
  const [bootstrapResult, setBootstrapResult] = useState(null); // {created:[], skipped:[], totalManagers}
  const [bootstrapping, setBootstrapping] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/admin/ext-clients`, { headers: authHeaders() });
      setItems(r.data.items || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createOne = async () => {
    if (!form.name.trim()) {
      toast.error(t('adm_name_is_required_2'));
      return;
    }
    try {
      const r = await axios.post(
        `${API}/api/admin/ext-clients`,
        { name: form.name.trim(), managerEmail: form.managerEmail.trim() || undefined },
        { headers: authHeaders() },
      );
      setSecretShow({ clientId: r.data.clientId, secret: r.data.secret });
      setForm({ name: '', managerEmail: '' });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    }
  };

  const bootstrapAll = async () => {
    if (
      !window.confirm(
        t('r9_create_ext_client_confirm'),
      )
    )
      return;
    setBootstrapping(true);
    try {
      const r = await axios.post(
        `${API}/api/admin/ext-clients/bootstrap`,
        {},
        { headers: authHeaders() },
      );
      setBootstrapResult(r.data);
      const { created = [], skipped = [], totalManagers = 0 } = r.data;
      if (created.length > 0) {
        toast.success(`${t('r9_created')}: ${created.length} · ${t('r9_skipped')}: ${skipped.length} · ${t('r9_total_managers')}: ${totalManagers}`);
      } else if (totalManagers === 0) {
        toast.info(t('adm_no_managers_in_the_system_yet_create_them_via_admi'));
      } else {
        toast.info(`${t('r9_all')} ${totalManagers} ${t('r9_managers_have_active_client')}`);
      }
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally {
      setBootstrapping(false);
    }
  };

  const revoke = async (clientId) => {
    if (!window.confirm(`${t('r9_revoke_client')} ${clientId}? ${t('r9_signatures_invalid')}`)) return;
    try {
      await axios.post(`${API}/api/admin/ext-clients/${clientId}/revoke`, {}, { headers: authHeaders() });
      toast.success(t('adm_withdrawn'));
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    }
  };

  const rotate = async (clientId) => {
    if (!window.confirm(t('adm3_b1211eb53f'))) return;
    try {
      const r = await axios.post(
        `${API}/api/admin/ext-clients/${clientId}/rotate`,
        {},
        { headers: authHeaders() },
      );
      setSecretShow({ clientId, secret: r.data.secret });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0, color: '#1e293b' }}>{t('adm_extension_hmacclients')}</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        {t('adm3_a5aeb1abd6')}
      </p>

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h3 style={{ marginTop: 0, color: '#334155' }}>{t('adm_new_customer')}</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block' }}>{t('adm_name_2')}</label>
            <input
              data-testid="new-client-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="manager-alice"
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                minWidth: 220,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block' }}>{t('adm3_email_df557ae5ed')}</label>
            <input
              data-testid="new-client-email"
              value={form.managerEmail}
              onChange={(e) => setForm((f) => ({ ...f, managerEmail: e.target.value }))}
              placeholder={t('adm_alicebibicars')}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                minWidth: 240,
              }}
            />
          </div>
          <button
            data-testid="create-client-btn"
            onClick={createOne}
            style={{
              padding: '9px 18px',
              borderRadius: 6,
              border: 'none',
              background: '#0ea5e9',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('adm_create')}
          </button>
          <button
            data-testid="bootstrap-btn"
            onClick={bootstrapAll}
            disabled={bootstrapping}
            style={{
              padding: '9px 18px',
              borderRadius: 6,
              border: '1px solid #7c3aed',
              background: bootstrapping ? '#e9d5ff' : '#fff',
              color: '#7c3aed',
              fontWeight: 600,
              cursor: bootstrapping ? 'wait' : 'pointer',
            }}
            title={t('adm_automatically_create_ext_client_for_all_managers_w')}
          >
            {bootstrapping ? '⏳ Bootstrap…' : t('adm3_e6eda2f1ae')}
          </button>
        </div>
      </div>

      {bootstrapResult && (
        <div
          data-testid="bootstrap-result"
          style={{
            background: '#faf5ff',
            border: '1px solid #d8b4fe',
            borderRadius: 10,
            padding: 18,
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 700, color: '#581c87', marginBottom: 10, fontSize: 15 }}>
            {t('adm_bootstrap_managers_result')}
          </div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 12, color: '#6b21a8', fontSize: 13 }}>
            <span>
              {t('adm_total_managers')} <b>{bootstrapResult.totalManagers}</b>
            </span>
            <span>
              {t('adm_created')} <b>{bootstrapResult.created?.length || 0}</b>
            </span>
            <span>
              {t('adm3_caa452faa9')} <b>{bootstrapResult.skipped?.length || 0}</b>
            </span>
          </div>
          {bootstrapResult.created && bootstrapResult.created.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: '#7c3aed', marginBottom: 8, fontWeight: 600 }}>
                {t('adm_copy_the_secrets_now_they_will_be_lost_after_closi')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bootstrapResult.created.map((c) => (
                  <div
                    key={c.clientId}
                    style={{
                      background: '#fff',
                      border: '1px solid #e9d5ff',
                      borderRadius: 8,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: 12, color: '#7c3aed', minWidth: 180 }}>
                      📧 <b>{c.managerEmail}</b>
                    </span>
                    <code style={{ fontSize: 11, color: '#4b5563' }}>
                      {c.clientId}
                    </code>
                    <code
                      style={{
                        flex: 1,
                        background: '#1e1b4b',
                        color: '#c4b5fd',
                        padding: '6px 10px',
                        borderRadius: 4,
                        fontSize: 12,
                        fontFamily: 'monospace',
                        userSelect: 'all',
                        minWidth: 280,
                      }}
                    >
                      {c.secret}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText(c.secret);
                        toast.success(`${t('r9_copied')}: ${c.managerEmail}`);
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: '1px solid #7c3aed',
                        background: '#fff',
                        color: '#7c3aed',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {t('adm_copy')}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <button
            onClick={() => setBootstrapResult(null)}
            style={{
              marginTop: 12,
              padding: '7px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#7c3aed',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('adm_close_panel')}
          </button>
        </div>
      )}

      {secretShow && (
        <div
          style={{
            background: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 700, color: '#78350f', marginBottom: 6 }}>
            {t('adm_save_the_secret_now_it_is_shown_only_once')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <code style={{ fontSize: 12, color: '#78350f' }}>
              clientId: <b>{secretShow.clientId}</b>
            </code>
            <code
              style={{
                background: '#78350f',
                color: '#fef3c7',
                padding: '6px 10px',
                borderRadius: 4,
                fontSize: 13,
                fontFamily: 'monospace',
                userSelect: 'all',
              }}
            >
              {secretShow.secret}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(secretShow.secret);
                toast.success(t('copied'));
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #78350f',
                background: '#fff',
                cursor: 'pointer',
                color: '#78350f',
                fontWeight: 600,
              }}
            >
              {t('adm_copy')}
            </button>
            <button
              onClick={() => setSecretShow(null)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: '#78350f',
                color: '#fef3c7',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {t('adm_understood')}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <Th>{t('clientId')}</Th>
              <Th>{t('adm_name_2')}</Th>
              <Th>{t("emailLabel")}</Th>
              <Th>{t('statusGeneric')}</Th>
              <Th>{t('createdOn')}</Th>
              <Th>{t('actionsUk')}</Th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                  {t('adm_loading_3')}
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                  {t('adm_no_customers_yet')}
                </td>
              </tr>
            )}
            {items.map((c) => (
              <tr key={c.clientId} style={{ borderTop: '1px solid #e2e8f0' }}>
                <Td>
                  <code style={{ fontSize: 12 }}>{c.clientId}</code>
                </Td>
                <Td>{c.name}</Td>
                <Td>{c.managerEmail || '—'}</Td>
                <Td>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: c.active ? '#d1fae5' : '#fee2e2',
                      color: c.active ? '#047857' : '#991b1b',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {c.active ? 'active' : 'revoked'}
                  </span>
                </Td>
                <Td>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}
                  </span>
                </Td>
                <Td>
                  {c.active && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => rotate(c.clientId)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #0ea5e9',
                          background: '#fff',
                          color: '#0ea5e9',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {t('adm_rotate')}
                      </button>
                      <button
                        onClick={() => revoke(c.clientId)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #ef4444',
                          background: '#ef4444',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {t('adm_withdraw')}
                      </button>
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }) {
  return (
    <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
      {children}
    </th>
  );
}
function Td({ children }) {
  const { t } = useLang();
  return <td style={{ padding: '12px 14px' }}>{children}</td>;
}
