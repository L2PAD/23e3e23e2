/**
 * VesselFinder Admin Console — simplified
 *
 * Only what an admin actually needs:
 *  1. Status block (cookies / online / heartbeat / успешные тики)
 *  2. One-click «Установить расширение» + «Sync cookies helper»
 *  3. Единый поиск (имя / MMSI / IMO / VIN / container / lot)
 *  4. Список активных shipments с кнопкой «Tick now» напрямую
 *  5. Bind vessel → shipment (предзаполняется из поиска)
 *
 * Никакого bbox, raw payload диагностики и прочего мусора.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { useLang } from '../../i18n';
import {
  Anchor,
  ArrowClockwise,
  Boat,
  CheckCircle,
  Download,
  Lightning,
  Link as LinkIcon,
  MagnifyingGlass,
  Power,
  Target,
  XCircle,
  Warning,
} from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// ---------- helpers ----------
const fmtAgo = (iso) => {
  if (!iso) return '—';
  const ms = new Date(iso).getTime();
  const sec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
};

function StatusPill({ kind, children }) {
  // Unified neutral design: small dot showing status colour, the chip itself
  // uses the standard admin neutral background. Matches the rest of the UI
  // (no more loud emerald/amber/rose filled badges).
  const dot =
    kind === 'healthy' ? '#16A34A'
    : kind === 'degraded' ? '#F59E0B'
    : kind === 'expired' ? '#DC2626'
    : '#A1A1AA';
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#E4E4E7] bg-white px-3 py-1 text-[12px] font-semibold text-[#3F3F46]">
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
      {children}
    </span>
  );
}

function Stat({ label, value, sub, icon: Icon, tone = 'slate' }) {
  // Neutral admin card: black value, grey supporting text. Tone now only
  // tints the value's left dot — keeps visual rhythm consistent.
  const dot = {
    emerald: '#16A34A',
    rose: '#DC2626',
    amber: '#F59E0B',
    sky: '#2563EB',
    slate: '#A1A1AA',
  }[tone] || '#A1A1AA';
  return (
    <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
      <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-[#71717A] font-semibold">
        {Icon ? <Icon size={13} /> : (
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
        )}
        {label}
      </div>
      <div className="mt-1.5 text-[22px] font-bold text-[#18181B] leading-tight">{value ?? '—'}</div>
      {sub ? <div className="mt-0.5 text-[12px] text-[#71717A] truncate">{sub}</div> : null}
    </div>
  );
}

// ---------- main ----------
export default function VesselFinderSessionPage() {
  const { t } = useLang();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // shipments list
  const [shipments, setShipments] = useState([]);
  const [tickingId, setTickingId] = useState(null);
  const [tickResults, setTickResults] = useState({}); // shipmentId -> result

  // unified search
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchData, setSearchData] = useState(null);

  // bind
  const [bindShipmentId, setBindShipmentId] = useState('');
  const [bindVin, setBindVin] = useState('');
  const [bindMmsi, setBindMmsi] = useState('');
  const [bindImo, setBindImo] = useState('');
  const [bindName, setBindName] = useState('');
  const [bindContainer, setBindContainer] = useState('');
  const [bindContainerSeal, setBindContainerSeal] = useState('');
  const [bindForceNew, setBindForceNew] = useState(false);
  const [bindNewStageLabel, setBindNewStageLabel] = useState('');
  const [bindBusy, setBindBusy] = useState(false);
  const [bindResult, setBindResult] = useState(null);

  // vessel history for currently-selected shipment
  const [vesselHistory, setVesselHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // help modal
  const [showHelp, setShowHelp] = useState(false);

  // ext-clients (BIBI Cars / auction parser extension keys)
  const [extClients, setExtClients] = useState([]);
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState(null);
  const [newSecret, setNewSecret] = useState(null);     // last secret returned by bootstrap/rotate
  const [copiedField, setCopiedField] = useState(null);

  // ---- data loaders ----
  const loadStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/vesselfinder/session/status`);
      setStatus(res.data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadShipments = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/shipments`);
      const items = res.data?.items || res.data?.data || [];
      setShipments(items);
    } catch { /* silent */ }
  }, []);

  // ── Extension keys (clientId + HMAC secret) ─────────────────────────
  // The auction-parser extension (BIBI Cars / Poctra etc.) needs an
  // ext-client pair to sign requests with HMAC.  The Vessel Sync extension
  // already bakes the shared secret at build time, so the keys block is
  // shown here purely so the operator can copy them into the browser
  // extension popup when prompted for "missing keys".
  const authHeaders = () => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadExtClients = useCallback(async () => {
    setExtError(null);
    try {
      const r = await axios.get(`${API_URL}/api/admin/ext-clients`, { headers: authHeaders() });
      setExtClients(r.data?.items || []);
    } catch (e) {
      setExtError(e?.response?.data?.detail || e.message);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadShipments();
    loadExtClients();
    const t1 = setInterval(loadStatus, 10000);
    const t2 = setInterval(loadShipments, 30000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [loadStatus, loadShipments, loadExtClients]);

  // ---- actions ----
  const bootstrapExtClient = async () => {
    setExtLoading(true);
    setExtError(null);
    try {
      const r = await axios.post(
        `${API_URL}/api/admin/ext-clients/bootstrap`,
        { label: 'Browser extension', note: 'Created from Vessel Sync admin page' },
        { headers: authHeaders() },
      );
      const created = (r.data?.created || [])[0];
      if (created?.secret) {
        // Bootstrap returned a NEW client → secret is shown ONLY this once
        setNewSecret({ clientId: created.clientId, secret: created.secret, name: created.name });
      }
      await loadExtClients();
    } catch (e) {
      setExtError(e?.response?.data?.detail || e.message);
    } finally {
      setExtLoading(false);
    }
  };

  const rotateExtClient = async (clientId) => {
    if (!window.confirm(`Rotate secret for ${clientId}? The old secret stops working immediately.`)) return;
    setExtLoading(true);
    setExtError(null);
    try {
      const r = await axios.post(
        `${API_URL}/api/admin/ext-clients/${clientId}/rotate`,
        {},
        { headers: authHeaders() },
      );
      if (r.data?.secret) {
        setNewSecret({ clientId, secret: r.data.secret, name: r.data.name });
      }
      await loadExtClients();
    } catch (e) {
      setExtError(e?.response?.data?.detail || e.message);
    } finally {
      setExtLoading(false);
    }
  };

  const copyToClipboard = async (value, field) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {}
  };

  const downloadExtension = async () => {
    // The extension ZIP is behind `require_admin`, so we can't use a plain
    // <a href> / window.location — the browser does NOT attach the JWT
    // from localStorage to a top-level navigation. We fetch it via axios
    // with Authorization header and trigger the download from the blob.
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token) {
      alert(t('vfAuthRequired'));
      return;
    }
    try {
      setBusy(true);
      const r = await axios.get(
        `${API_URL}/api/admin/vesselfinder/extension/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        },
      );
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      // filename comes from Content-Disposition but we set explicit too
      a.download = 'bibi-vesselfinder-extension.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      const msg =
        e.response?.status === 401
          ? t('vfAuthExpired')
          : e.response?.status === 403
          ? t('vfNoRights')
          : e.response?.data?.detail || e.message || t('vfAuthRequired');
      alert(msg);
    } finally {
      setBusy(false);
    }
  };

  const pingSession = async () => {
    setBusy(true);
    try {
      await axios.post(`${API_URL}/api/vesselfinder/session/test`);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const clearSession = async () => {
    if (!window.confirm(t('vfDisconnectConfirm'))) return;
    setBusy(true);
    try {
      await axios.delete(`${API_URL}/api/vesselfinder/session`);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const resetCounters = async () => {
    if (!window.confirm(t('vfResetConfirm'))) return;
    setBusy(true);
    try {
      await axios.post(`${API_URL}/api/vesselfinder/session/reset-counters`);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const tickShipment = async (shipmentId) => {
    setTickingId(shipmentId);
    try {
      const res = await axios.post(`${API_URL}/api/shipments/${shipmentId}/tick`);
      setTickResults((prev) => ({ ...prev, [shipmentId]: { ok: true, data: res.data, at: new Date() } }));
    } catch (e) {
      setTickResults((prev) => ({
        ...prev,
        [shipmentId]: { ok: false, error: e?.response?.data?.detail || String(e), at: new Date() },
      }));
    } finally {
      setTickingId(null);
      loadStatus();
    }
  };

  const tickAllActive = async () => {
    const active = shipments.filter((s) => s.trackingActive);
    if (!active.length) return;
    if (!window.confirm(t('vfTickActiveConfirm').replace('{count}', active.length))) return;
    for (const s of active) {
      // eslint-disable-next-line no-await-in-loop
      await tickShipment(s.id);
    }
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchData(null);
    try {
      // parallel: legacy manager search + NEW unified shipment search + live VF
      const [dbRes, richRes, liveRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/manager/tracking/search`, { params: { q } }),
        axios.get(`${API_URL}/api/admin/shipments/search`, { params: { q, limit: 30 } }),
        axios.get(`${API_URL}/api/vesselfinder/vessels/search`, { params: { bbox: '-180,-80,180,80', query: q } }),
      ]);
      setSearchData({
        db:   dbRes.status   === 'fulfilled' ? dbRes.value.data   : { error: String(dbRes.reason) },
        rich: richRes.status === 'fulfilled' ? richRes.value.data : { error: String(richRes.reason) },
        live: liveRes.status === 'fulfilled' ? liveRes.value.data : { error: String(liveRes.reason?.response?.data?.detail || liveRes.reason) },
      });
    } finally {
      setSearching(false);
    }
  };

  const prefillBind = (v) => {
    setBindMmsi(v.mmsi || '');
    setBindImo(v.imo || '');
    setBindName(v.name || '');
    document.getElementById('bind-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Load vessel history whenever the selected shipment changes
  const loadVesselHistory = useCallback(async (sid) => {
    if (!sid) { setVesselHistory(null); return; }
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/shipments/${sid}/vessel-history`);
      setVesselHistory(res.data);
    } catch (e) {
      setVesselHistory({ error: e?.response?.data?.detail || String(e) });
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVesselHistory(bindShipmentId);
  }, [bindShipmentId, loadVesselHistory]);

  // Auto-prefill Shipment ID from ?shipmentId=... (used by Exceptions deep-link)
  const _location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(_location.search);
    const sid = params.get('shipmentId');
    if (sid && sid !== bindShipmentId) {
      setBindShipmentId(sid);
      setTimeout(() => {
        document.getElementById('bind-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_location.search]);

  // Auto-resolve VIN → shipmentId when VIN is entered (debounced)
  useEffect(() => {
    const vin = bindVin.trim().toUpperCase();
    if (!vin || vin.length < 10) return;
    const h = setTimeout(async () => {
      // Try to find a shipment for this VIN in the shipments list first
      const match = shipments.find((s) => (s.vin || '').toUpperCase() === vin);
      if (match && match.id !== bindShipmentId) setBindShipmentId(match.id);
    }, 400);
    return () => clearTimeout(h);
  }, [bindVin, shipments, bindShipmentId]);

  const doBind = async () => {
    setBindBusy(true);
    setBindResult(null);
    try {
      // If VIN is provided and no shipmentId, route through /bind-by-vin
      if (bindVin.trim() && !bindShipmentId) {
        const res = await axios.post(`${API_URL}/api/shipments/bind-by-vin`, {
          vin:            bindVin.trim(),
          mmsi:           bindMmsi.trim() || null,
          imo:            bindImo.trim() || null,
          name:           bindName.trim() || null,
          container:      bindContainer.trim() || null,
          containerSeal:  bindContainerSeal.trim() || null,
          forceNewStage:  bindForceNew,
          newStageLabel:  bindNewStageLabel.trim() || null,
        });
        setBindResult({ ok: true, data: res.data });
        if (res.data.shipmentId) setBindShipmentId(res.data.shipmentId);
      } else {
        if (!bindShipmentId) {
          setBindResult({ ok: false, error: t('adm2_shipment_id_vin_43d326d0b8') });
          return;
        }
        const res = await axios.post(
          `${API_URL}/api/shipments/${bindShipmentId}/vessel`,
          {
            mmsi:          bindMmsi.trim() || null,
            imo:           bindImo.trim() || null,
            name:          bindName.trim() || null,
            container:     bindContainer.trim() || null,
            containerSeal: bindContainerSeal.trim() || null,
            forceNewStage: bindForceNew,
            newStageLabel: bindNewStageLabel.trim() || null,
          }
        );
        setBindResult({ ok: true, data: res.data });
      }
      await loadShipments();
      await loadVesselHistory(bindShipmentId);
    } catch (e) {
      setBindResult({ ok: false, error: e?.response?.data?.detail || String(e) });
    } finally {
      setBindBusy(false);
    }
  };

  // Explicit "Сменить судно" — confirms + calls /transfer-vessel endpoint.
  const doTransferVessel = async () => {
    if (!bindShipmentId) { setBindResult({ ok: false, error: t('vfBindChooseShipment') }); return; }
    if (!bindMmsi.trim() && !bindImo.trim() && !bindName.trim()) {
      setBindResult({ ok: false, error: 'MMSI / IMO / vessel name required' });
      return;
    }
    const confirmMsg = t('vfBindConfirmMsg').replace('{name}', bindName || bindMmsi);
    if (!window.confirm(confirmMsg)) return;
    setBindBusy(true);
    setBindResult(null);
    try {
      const res = await axios.post(
        `${API_URL}/api/shipments/${bindShipmentId}/transfer-vessel`,
        {
          mmsi:          bindMmsi.trim() || null,
          imo:           bindImo.trim() || null,
          name:          bindName.trim() || null,
          container:     bindContainer.trim() || null,
          containerSeal: bindContainerSeal.trim() || null,
          label:         bindNewStageLabel.trim() || null,
        }
      );
      setBindResult({ ok: true, data: res.data, transfer: true });
      await loadShipments();
      await loadVesselHistory(bindShipmentId);
    } catch (e) {
      setBindResult({ ok: false, error: e?.response?.data?.detail || String(e) });
    } finally {
      setBindBusy(false);
    }
  };

  // ---- derived ----
  const sessionStatus = status?.sessionStatus || 'not_connected';
  const statusKind = {
    healthy: 'healthy',
    degraded: 'degraded',
    paused: 'degraded',
    expired: 'expired',
    not_connected: 'offline',
  }[sessionStatus] || 'offline';

  // Three-level truth:
  //   1. EXTENSION HEALTH — heartbeat < 5min and cookies present
  //   2. VF FETCH HEALTH — did VesselFinder return vessels recently (cookies valid)
  //   3. MATCH HEALTH — did our target shipment match in the last fetches
  const extensionOk = status?.heartbeatAgeSec != null && status.heartbeatAgeSec < 300 && status.cookiesCount > 0;
  const vfFetchOk = status?.lastVfFetchOkAt
    ? (Date.now() - new Date(status.lastVfFetchOkAt).getTime()) < 10 * 60 * 1000
    : false;
  const vfFetchOkOrMatch = vfFetchOk || (status?.successCount > 0);
  const matchOk = status?.successCount > 0;
  const activeCount = shipments.filter((s) => s.trackingActive).length;
  const parserRunning = extensionOk; // keep name for legacy references below

  const dbShipments = searchData?.db?.data?.shipments || [];
  const dbDeals = searchData?.db?.data?.deals || [];
  const dbVehicles = searchData?.db?.data?.vehicles || [];
  const liveVessels = searchData?.live?.vessels || [];
  const classification = searchData?.db?.classification;
  // NEW: rich search results (VIN / container / vessel name / MMSI / IMO aware)
  const richShipments = searchData?.rich?.results || [];

  const totalFound = useMemo(() => (
    dbShipments.length + dbDeals.length + dbVehicles.length + liveVessels.length + richShipments.length
  ), [dbShipments, dbDeals, dbVehicles, liveVessels, richShipments]);

  // ---- render ----
  return (
    <div className="space-y-6">
      {/* ================ HEADER ================ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-[#18181B] flex items-center gap-2.5" style={{ fontFamily: 'Mazzard, Mazzard H, Mazzard M, system-ui, sans-serif' }}>
            <Anchor size={22} weight="duotone" className="text-[#18181B]" />
            {t('vesselFinderTracker')}
          </h1>
          <p className="mt-1 text-[13px] text-[#71717A] max-w-2xl">
            {t('vfSubtitle')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href="/admin/shipments/exceptions"
            className="inline-flex items-center gap-2 rounded-lg border border-[#E4E4E7] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#3F3F46] hover:bg-[#FAFAFA]"
            title={t('vfBtnExceptionsTitle')}
          >
            <Warning size={15} weight="duotone" /> {t('vfBtnExceptions')}
          </a>
          <button
            onClick={downloadExtension}
            className="inline-flex items-center gap-2 rounded-lg bg-[#18181B] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#3F3F46]"
          >
            <Download size={15} weight="bold" /> {t('vfBtnInstallExtension')}
          </button>
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E4E4E7] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#3F3F46] hover:bg-[#FAFAFA]"
          >
            {t('vfBtnInstructions')}
          </button>
          <button
            onClick={() => { loadStatus(); loadShipments(); }}
            className="inline-flex items-center justify-center rounded-lg border border-[#E4E4E7] bg-white px-3 py-2.5 text-[#3F3F46] hover:bg-[#FAFAFA]"
            title={t('vfBtnRefreshTitle')}
          >
            <ArrowClockwise size={15} />
          </button>
        </div>
      </div>

      {/* ================ HELP PANEL ================ */}
      {showHelp && (
        <div className="rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] p-5 text-[13.5px] text-[#3F3F46]">
          <h3 className="font-semibold text-[#18181B] mb-2">{t('vfHowToConnect')}</h3>
          <ol className="list-decimal ml-5 space-y-1.5">
            <li>{t('vfStep1')}</li>
            <li>{t('vfStep2')}</li>
            <li>{t('vfStep3prefix')}<b>{t('bibiVesselSync')}</b>{t('vfStep3middle')}<code className="bg-white border border-[#E4E4E7] rounded px-1.5 py-0.5 text-[12px]">{t('vfStep3yourSiteUrl')}</code>{t('vfStep3suffix')}</li>
            <li>{t('vfStep4prefix')}<a className="text-[#18181B] underline underline-offset-2" href="https://www.vesselfinder.com" target="_blank" rel="noreferrer">{t('adm_vesselfindercom')}</a>{t('vfStep4suffix')}</li>
            <li>{t('vfStep5prefix')}<b>{t('vfStep5connect')}</b>{t('vfStep5suffix')}<b>{t('vfStep5online')}</b>{t('vfStep5dot')}</li>
            <li>{t('vfStep6')}</li>
          </ol>
          <div className="mt-4 pt-3 border-t border-[#E4E4E7] text-[12.5px] text-[#52525B]">
            <b className="text-[#18181B]">BIBI Cars (auction parser) extension — required keys:</b>
            <ol className="list-decimal ml-5 mt-1.5 space-y-1">
              <li>Scroll down to the <b>“Extension keys”</b> block on this page and click <b>“Generate new client”</b>.</li>
              <li>Copy <code className="bg-white border border-[#E4E4E7] rounded px-1 text-[11px]">Client ID</code> and <code className="bg-white border border-[#E4E4E7] rounded px-1 text-[11px]">Client Secret</code> (secret is shown ONCE).</li>
              <li>Open the BIBI Cars extension popup → paste your CRM URL → paste the keys into <b>Client ID</b> / <b>Client Secret</b> fields → <b>Save</b>.</li>
              <li>The “missing keys” warning will disappear and the extension starts sending HMAC-signed observations.</li>
            </ol>
          </div>
        </div>
      )}

      {/* ================ EXTENSION KEYS ================
          The auction-parser extension (BIBI Cars) needs a `clientId` and a
          `secret` to HMAC-sign its requests.  This panel:
            • Lists every active ext-client (created via /bootstrap).
            • Lets the operator copy the clientId for that machine.
            • Lets the operator generate / rotate a secret — secrets are
              shown ONCE (we only store the salted hash on the server).
          The Vessel Sync extension has its secret baked at build time and
          does NOT need anything from here. */}
      <section className="rounded-2xl border border-[#E4E4E7] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#18181B]">Extension keys (BIBI Cars parser)</h3>
            <p className="mt-1 text-[12.5px] text-[#71717A] max-w-2xl">
              Paste these into the BIBI Cars extension popup → fields
              <b className="text-[#18181B]"> Client ID </b> and
              <b className="text-[#18181B]"> Client Secret</b>.
              The Vessel Sync extension does <b>NOT</b> need anything here —
              its secret is baked at build time.
            </p>
          </div>
          <button
            onClick={bootstrapExtClient}
            disabled={extLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#18181B] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#3F3F46] disabled:opacity-40"
            data-testid="vf-ext-bootstrap"
          >
            + Generate new client
          </button>
        </div>

        {extError && (
          <div className="mb-3 rounded-lg bg-[#FEE2E2] border border-[#FCA5A5] text-[#7F1D1D] text-[12px] px-3 py-2">
            {extError}
          </div>
        )}

        {/* "One-time" reveal banner — secret is shown ONLY right after
            bootstrap/rotate; copying is the only way to keep it. */}
        {newSecret && (
          <div className="mb-3 rounded-xl border border-[#FBBF24] bg-[#FFFBEB] p-4 text-[13px] text-[#78350F]">
            <div className="flex items-center justify-between mb-2">
              <b>✅ New keys for: {newSecret.name || newSecret.clientId}</b>
              <button
                onClick={() => setNewSecret(null)}
                className="text-[#78350F] hover:text-[#451A03] text-[12px] underline"
              >
                Dismiss
              </button>
            </div>
            <div className="text-[11.5px] mb-3">
              ⚠️  <b>Copy the secret NOW.</b> It is hashed on the server and cannot be shown again.
              Rotate to issue a new one.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-[#92400E] font-semibold mb-1">Client ID</div>
                <div className="flex items-center gap-2 bg-white rounded border border-[#FBBF24] px-2 py-1.5">
                  <code className="text-[12px] text-[#18181B] flex-1 break-all" data-testid="vf-ext-new-client-id">{newSecret.clientId}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newSecret.clientId, `new-${newSecret.clientId}-id`)}
                    className="text-[11px] text-[#18181B] underline hover:no-underline"
                  >
                    {copiedField === `new-${newSecret.clientId}-id` ? 'copied' : 'copy'}
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-[#92400E] font-semibold mb-1">Client Secret (shown ONCE)</div>
                <div className="flex items-center gap-2 bg-white rounded border border-[#FBBF24] px-2 py-1.5">
                  <code className="text-[12px] text-[#18181B] flex-1 break-all" data-testid="vf-ext-new-client-secret">{newSecret.secret}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newSecret.secret, `new-${newSecret.clientId}-secret`)}
                    className="text-[11px] text-[#18181B] underline hover:no-underline"
                  >
                    {copiedField === `new-${newSecret.clientId}-secret` ? 'copied' : 'copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* List of existing clients */}
        {extClients.length === 0 ? (
          <div className="text-[12.5px] text-[#71717A] py-2">
            No extension clients yet. Click <b>Generate new client</b> above to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wider text-[#71717A] border-b border-[#E4E4E7]">
                  <th className="py-2 pr-3 font-semibold">Client ID</th>
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  <th className="py-2 pr-3 font-semibold">Manager email</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Created</th>
                  <th className="py-2 pr-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {extClients.map((c) => (
                  <tr key={c.clientId} className="border-b border-[#F4F4F5]">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <code className="text-[12px] text-[#18181B] break-all">{c.clientId}</code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(c.clientId, `list-${c.clientId}-id`)}
                          className="text-[11px] text-[#18181B] underline hover:no-underline"
                        >
                          {copiedField === `list-${c.clientId}-id` ? 'copied' : 'copy'}
                        </button>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-[#18181B]">{c.name || '—'}</td>
                    <td className="py-2 pr-3 text-[#71717A]">{c.managerEmail || '—'}</td>
                    <td className="py-2 pr-3">
                      {c.active ? (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#166534] text-[10.5px] font-semibold">active</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#7F1D1D] text-[10.5px] font-semibold">revoked</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-[#71717A] text-[11.5px]">
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        type="button"
                        onClick={() => rotateExtClient(c.clientId)}
                        disabled={extLoading}
                        className="inline-flex items-center gap-1 rounded border border-[#E4E4E7] bg-white px-2 py-1 text-[11px] font-semibold text-[#18181B] hover:bg-[#FAFAFA] disabled:opacity-40"
                      >
                        Rotate secret
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================ STATUS STRIP ================ */}
      <section className="rounded-2xl border border-[#E4E4E7] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill kind={extensionOk ? 'healthy' : 'expired'}>
              {t('vfPillStep1Prefix')} {extensionOk ? t('vfPillStep1Working') : t('vfPillStep1Offline')}
            </StatusPill>
            <StatusPill kind={vfFetchOkOrMatch ? 'healthy' : (extensionOk ? 'degraded' : 'offline')}>
              {t('vfPillStep2Prefix')} {vfFetchOkOrMatch ? '✓' : '—'}
            </StatusPill>
            <StatusPill kind={matchOk ? 'healthy' : (vfFetchOkOrMatch ? 'degraded' : 'offline')}>
              {t('vfPillStep3Prefix')} {matchOk ? '✓' : '—'}
            </StatusPill>
            {status?.extensionVersion && (
              <span className="text-[11.5px] text-[#71717A] ml-1">ext v{status.extensionVersion}</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={pingSession}
              disabled={busy || !status?.connected}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#18181B] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#3F3F46] disabled:opacity-40"
            >
              <Lightning size={13} weight="fill" /> {t('vfBtnPingSession')}
            </button>
            <button
              onClick={tickAllActive}
              disabled={!activeCount}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-[12px] font-semibold text-[#3F3F46] hover:bg-[#FAFAFA] disabled:opacity-40"
            >
              <Target size={13} weight="duotone" /> {t('vfBtnTickAll')} ({activeCount})
            </button>
            <button
              onClick={resetCounters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-[12px] font-semibold text-[#3F3F46] hover:bg-[#FAFAFA]"
              title={t('vfBtnResetCountersTitle')}
            >
              <ArrowClockwise size={13} /> {t('vfBtnResetCounters')}
            </button>
            <button
              onClick={clearSession}
              disabled={!status?.connected}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-[12px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-40"
            >
              <Power size={13} /> {t('vfBtnDisconnectSession')}
            </button>
          </div>
        </div>
        {status?.sessionMessage && (
          <div className="mb-4 text-[13px] rounded-lg border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[#3F3F46] flex items-center gap-2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background:
                sessionStatus === 'healthy' ? '#16A34A' :
                sessionStatus === 'expired' ? '#DC2626' :
                '#F59E0B'
              }}
            />
            {status.sessionMessage}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label={t('cookiesLabel')} value={status?.cookiesCount ?? 0} icon={CheckCircle} tone={status?.cookiesCount ? 'emerald' : 'slate'} />
          <Stat label={t('heartbeatLabel')} value={status?.heartbeatAgeSec != null ? fmtAgo(status.lastHeartbeatAt) : '—'} sub={extensionOk ? t('vfStatExtAlive') : t('vfStatExtNoSignal')} tone={extensionOk ? 'emerald' : 'rose'} />
          <Stat label={t('vfStatVfResponds')} value={status?.vfFetchOkCount != null ? (status.vfFetchOkCount + (status?.successCount || 0)) : '—'} sub={status?.lastVfFetchOkAt ? fmtAgo(status.lastVfFetchOkAt) : (status?.lastSuccessAt ? fmtAgo(status.lastSuccessAt) : t('vfStatVfNoSuccess'))} tone={vfFetchOkOrMatch ? 'emerald' : 'slate'} />
          <Stat label={t('vfStatOurMatches')} value={status?.successCount ?? 0} sub={status?.lastSuccessAt ? fmtAgo(status.lastSuccessAt) : t('vfStatNoMatchesYet')} tone={matchOk ? 'emerald' : 'slate'} />
          <Stat label={t('vfStatLastReason')} value={status?.consecutiveFails != null ? `${status.consecutiveFails} ${t('vfStatConsecutive')}` : '—'} sub={status?.lastFailReason || t('vfStatOkLabel')} tone={status?.consecutiveFails > 5 ? 'amber' : 'slate'} />
        </div>
      </section>

      {/* ================ UNIFIED SEARCH ================ */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MagnifyingGlass size={18} className="text-slate-700" weight="bold" />
          <h2 className="text-base font-semibold text-slate-900">{t('vfSearchTitle')}</h2>
          <span className="text-xs text-slate-500">
            {t('vfSearchHint')}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder={t('adm_msc_oscar_wbaja7c52kww12345_227280290_mscu1234567')}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
          <button
            onClick={runSearch}
            disabled={searching || !query.trim()}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {searching ? t('vfSearchSearching') : t('vfSearchFind')}
          </button>
        </div>

        {searchData && (
          <div className="mt-4 space-y-3">
            <div className="text-xs text-slate-600 flex items-center gap-3">
              <span>{t('adm_found')} <b>{totalFound}</b></span>
              {classification && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px]">
                  type: {classification}
                </span>
              )}
            </div>

            {/* Live vessels */}
            {liveVessels.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-sky-700 mb-1.5 flex items-center gap-1">
                  <Boat size={14} weight="fill" /> {t('r9_live_vessels')} (VesselFinder) — {liveVessels.length}
                </div>
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="p-2 text-left">{t('name')}</th>
                        <th className="p-2 text-left">MMSI</th>
                        <th className="p-2 text-left">IMO</th>
                        <th className="p-2 text-left">{t('positionLabel')}</th>
                        <th className="p-2 text-left">{t('speedLabel')}</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveVessels.map((v, i) => (
                        <tr key={i} className="border-t border-slate-100 hover:bg-sky-50">
                          <td className="p-2 font-medium">{v.name || '—'}</td>
                          <td className="p-2 font-mono text-[10px]">{v.mmsi || '—'}</td>
                          <td className="p-2 font-mono text-[10px]">{v.imo || '—'}</td>
                          <td className="p-2 font-mono text-[10px]">
                            {v.lat != null ? `${v.lat.toFixed(3)}, ${v.lng?.toFixed(3)}` : '—'}
                          </td>
                          <td className="p-2">{v.speed ?? '—'} kn</td>
                          <td className="p-2">
                            <button
                              onClick={() => prefillBind(v)}
                              className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700"
                            >
                              {t('adm_bind_2')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Rich shipment results (VIN / container / vessel name / MMSI / IMO) */}
            {richShipments.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                  <Target size={14} weight="fill" /> Shipments (VIN / container / vessel) — {richShipments.length}
                </div>
                <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="p-2 text-left">{t('adm_vin_car')}</th>
                        <th className="p-2 text-left">{t('adm_container_vessel')}</th>
                        <th className="p-2 text-left">{t('adm_route')}</th>
                        <th className="p-2 text-left">{t('progress')}</th>
                        <th className="p-2 text-left">{t('sourceHealth')}</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {richShipments.map((s) => {
                        const healthCls = s.trackingHealth === 'ok' ? 'bg-emerald-100 text-emerald-700'
                          : s.trackingHealth === 'stale' ? 'bg-rose-100 text-rose-700'
                          : s.trackingHealth === 'estimated' ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600';
                        const healthLabel = s.trackingHealth === 'ok' ? '🟢 Live'
                          : s.trackingHealth === 'stale' ? '🔴 Stale'
                          : s.trackingHealth === 'estimated' ? '🟡 Estimated'
                          : '⚪ —';
                        return (
                          <tr key={s.id} className="border-t border-slate-100 hover:bg-emerald-50/40" data-testid={`rich-shipment-${s.id}`}>
                            <td className="p-2">
                              <div className="font-mono text-[11px] text-slate-900">{s.vin || '—'}</div>
                              <div className="font-mono text-[10px] text-slate-400">{s.id}</div>
                              {s.vehicleTitle && <div className="text-[11px] text-slate-700 mt-0.5">{s.vehicleTitle}</div>}
                            </td>
                            <td className="p-2">
                              {s.currentContainer?.number && (
                                <div className="text-[11px] font-mono text-indigo-700 flex items-center gap-1">
                                  📦 {s.currentContainer.number}
                                </div>
                              )}
                              {s.currentVessel?.name && (
                                <div className="text-[11px] text-sky-700 flex items-center gap-1 mt-0.5">
                                  ⚓ {s.currentVessel.name}
                                  {s.currentVessel.mmsi && <span className="text-[9px] text-slate-400 font-mono">· {s.currentVessel.mmsi}</span>}
                                </div>
                              )}
                              {!s.currentContainer?.number && !s.currentVessel?.name && (
                                <div className="text-[11px] text-slate-400 italic">{t('adm_not_assigned')}</div>
                              )}
                            </td>
                            <td className="p-2 text-[11px] text-slate-600">
                              {s.origin?.name || '—'} <span className="text-slate-400">→</span> {s.destination?.name || '—'}
                              {s.location && <div className="text-[10px] text-slate-500 mt-0.5">📍 {s.location}</div>}
                            </td>
                            <td className="p-2 w-28">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500" style={{ width: `${Math.round((s.progress || 0) * 100)}%` }} />
                                </div>
                                <span className="text-[10px] font-semibold text-slate-700 w-7 text-right">{Math.round((s.progress || 0) * 100)}%</span>
                              </div>
                            </td>
                            <td className="p-2">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${healthCls}`}>
                                {healthLabel}
                              </span>
                            </td>
                            <td className="p-2 text-right whitespace-nowrap">
                              <button
                                onClick={() => { setBindShipmentId(s.id); document.getElementById('bind-card')?.scrollIntoView({ behavior: 'smooth' }); }}
                                className="rounded bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-sky-700"
                              >
                                {t('adm_bind')}
                              </button>
                              <button
                                onClick={() => tickShipment(s.id)}
                                disabled={tickingId === s.id}
                                className="ml-1 rounded bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                              >
                                {tickingId === s.id ? '…' : 'Tick'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DB shipments */}
            {dbShipments.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-indigo-700 mb-1.5 flex items-center gap-1">
                  <Target size={14} weight="fill" /> {t('r9_shipments_in_db')} — {dbShipments.length}
                </div>
                <div className="space-y-1.5">
                  {dbShipments.map((s) => (
                    <div key={s.id} className="rounded-md border border-slate-200 p-2.5 text-xs flex items-center gap-3 hover:bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{s.vehicleTitle || s.id}</div>
                        <div className="text-slate-500 flex gap-2 font-mono text-[10px] mt-0.5">
                          <span>#{s.id}</span>
                          {s.vin && <span>VIN:{s.vin}</span>}
                          {s.vessel?.name && <span>⛴ {s.vessel.name}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => { setBindShipmentId(s.id); document.getElementById('bind-card')?.scrollIntoView({ behavior: 'smooth' }); }}
                        className="text-sky-600 text-[10px] font-semibold hover:text-sky-800"
                      >
                        {t('adm_use_id')}
                      </button>
                      <button
                        onClick={() => tickShipment(s.id)}
                        disabled={tickingId === s.id}
                        className="rounded bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                      >
                        {tickingId === s.id ? '…' : 'Tick'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No results */}
            {totalFound === 0 && !searching && (
              <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                {t('r9_nothing_found')}. {searchData?.live?.error ? <span className="text-rose-600">Live: {String(searchData.live.error).slice(0, 120)}</span> : null}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ================ SHIPMENTS WITH TICK ================ */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Boat size={18} weight="duotone" className="text-sky-600" />
            {t('vfActiveShipments')}
            <span className="text-xs text-slate-500 font-normal">({shipments.length})</span>
          </h2>
          <button onClick={loadShipments} className="text-xs text-sky-600 hover:text-sky-800 inline-flex items-center gap-1">
            <ArrowClockwise size={12} /> {t('vfBtnRefreshTitle')}
          </button>
        </div>
        {shipments.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-500">{t('vfShipmentsEmpty')}</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="p-2 text-left">{t('shipmentAlerts')}</th>
                  <th className="p-2 text-left">{t('vessel')}</th>
                  <th className="p-2 text-left">VIN</th>
                  <th className="p-2 text-left">{t('trackingLabel')}</th>
                  <th className="p-2 text-left">{t('adm_last_result')}</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => {
                  const r = tickResults[s.id];
                  return (
                    <tr key={s.id} className="border-t border-slate-100 hover:bg-sky-50/40">
                      <td className="p-2">
                        <div className="font-semibold text-slate-900">{s.vehicleTitle || '—'}</div>
                        <div className="font-mono text-[10px] text-slate-500">{s.id}</div>
                      </td>
                      <td className="p-2">
                        {s.vessel?.name ? (
                          <>
                            <div className="font-medium">{s.vessel.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">
                              {s.vessel.mmsi ? `MMSI:${s.vessel.mmsi}` : ''} {s.vessel.imo ? `IMO:${s.vessel.imo}` : ''}
                            </div>
                          </>
                        ) : <span className="text-slate-400">{t('adm_not_assigned_2')}</span>}
                      </td>
                      <td className="p-2 font-mono text-[10px]">{s.vin || '—'}</td>
                      <td className="p-2">
                        {s.trackingActive
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><CheckCircle size={10} weight="fill" /> ON</span>
                          : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">OFF</span>}
                      </td>
                      <td className="p-2 text-[10px]">
                        {r ? (
                          r.ok ? (
                            <span className="text-emerald-700">✓ {r.data?.source || 'ok'} @{r.at.toLocaleTimeString()}</span>
                          ) : (
                            <span className="text-rose-600" title={r.error}>✗ {String(r.error).slice(0, 40)}</span>
                          )
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => tickShipment(s.id)}
                          disabled={tickingId === s.id}
                          className="rounded bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 inline-flex items-center gap-1"
                        >
                          <Target size={10} /> {tickingId === s.id ? t('adm2_fd1567dc80') : 'Tick now'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================ BIND (VIN-centric) ================ */}
      <section id="bind-card" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <LinkIcon size={18} className="text-slate-700" weight="bold" />
          <h2 className="text-base font-semibold text-slate-900">{t('vfBindTitle')}</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {t('vfBindIntro1')}<b>VIN</b>{t('vfBindIntro2')}
          {' '}{t('vfBindIntro3')}<b>{t('vfBindIntroBold')}</b>{t('vfBindIntro4')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-xs text-slate-600 font-medium md:col-span-2">
            {t('adm3_e033ab5ffe')}
            <input
              value={bindVin}
              onChange={(e) => setBindVin(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
              placeholder={t('adm_wbaja7c52kww12345')}
            />
            {bindShipmentId && bindVin && (
              <div className="text-[10px] text-emerald-600 mt-0.5 font-mono">
                ✓ {t('r9_resolved')} → {bindShipmentId}
              </div>
            )}
          </label>
          <label className="text-xs text-slate-600 font-medium md:col-span-2">
            {t('adm3_3d7afec746')}
            <input
              value={bindShipmentId}
              onChange={(e) => setBindShipmentId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              placeholder="ship_test_customer_001_1"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs text-slate-600 font-medium">
            {t('adm_vessel_name')}
            <input
              value={bindName}
              onChange={(e) => setBindName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder={t('adm_msc_oscar')}
            />
          </label>
          <label className="text-xs text-slate-600 font-medium">
            MMSI
            <input
              value={bindMmsi}
              onChange={(e) => setBindMmsi(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              placeholder="227280290"
            />
          </label>
          <label className="text-xs text-slate-600 font-medium">
            IMO
            <input
              value={bindImo}
              onChange={(e) => setBindImo(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              placeholder="9629344"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs text-slate-600 font-medium">
            {t('adm_container_5')}
            <input
              value={bindContainer}
              onChange={(e) => setBindContainer(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              placeholder={t('adm_msku1234567')}
            />
          </label>
          <label className="text-xs text-slate-600 font-medium">
            {t('containerSeal')}
            <input
              value={bindContainerSeal}
              onChange={(e) => setBindContainerSeal(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
              placeholder={t('adm_seal001')}
            />
          </label>
          <label className="text-xs text-slate-600 font-medium">
            {t('vfBindNewStageLabel')}
            <input
              value={bindNewStageLabel}
              onChange={(e) => setBindNewStageLabel(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder={t('adm_transshipment_in_algeciras')}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={doBind}
            disabled={bindBusy || (!bindShipmentId && !bindVin.trim()) || (!bindMmsi && !bindImo && !bindName)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            {bindBusy ? t('vfBindBinding') : t('vfBindAction')}
          </button>

          <button
            onClick={doTransferVessel}
            disabled={bindBusy || !bindShipmentId || (!bindMmsi && !bindImo && !bindName)}
            className="rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-40 inline-flex items-center gap-2"
            title={t('vfBindForceNewStageTitle')}
          >
            <Warning size={14} weight="fill" /> {t('vfBindForceNewStage')}
          </button>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600 ml-auto">
            <input
              type="checkbox"
              checked={bindForceNew}
              onChange={(e) => setBindForceNew(e.target.checked)}
              className="rounded"
            />
            {t('vfBindForceNewStage')}
          </label>
        </div>

        {bindResult?.ok && (
          <div className={`mt-3 rounded-md border px-3 py-2 text-sm flex items-start gap-2 ${
            bindResult.data?.createdNewStage
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}>
            <CheckCircle size={16} weight="fill" className="mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium">
                {bindResult.data?.createdNewStage
                  ? `${t('vfBindResultNewStage')}${bindResult.data?.newStageId}`
                  : t('vfBindResultUpdated')}
              </div>
              <div className="text-xs mt-0.5">{t('shipmentAlerts')}<span className="font-mono">{bindResult.data?.shipmentId}</span>{t('vfBindStageCount')}<b>{bindResult.data?.vesselStagesCount}</b>
                {bindResult.data?.container && <> {t('adm_container_2')} <span className="font-mono">{bindResult.data.container.number}</span></>}
              </div>
            </div>
          </div>
        )}
        {bindResult && !bindResult.ok && (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 flex items-center gap-2">
            <XCircle size={16} weight="fill" /> {bindResult.error}
          </div>
        )}
      </section>

      {/* ================ VESSEL HISTORY ================ */}
      {bindShipmentId && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Boat size={18} weight="duotone" className="text-sky-600" />
            <h2 className="text-base font-semibold text-slate-900">{t('adm_shipping_history')}</h2>
            <span className="text-xs text-slate-500 font-mono">{bindShipmentId}</span>
            <button
              onClick={() => loadVesselHistory(bindShipmentId)}
              className="ml-auto text-xs text-sky-600 hover:text-sky-800 inline-flex items-center gap-1"
            >
              <ArrowClockwise size={12} /> {t('adm_refresh_2')}
            </button>
          </div>

          {historyLoading && (
            <div className="text-sm text-slate-500">{t('adm_loading_5')}</div>
          )}
          {vesselHistory?.error && (
            <div className="text-sm text-rose-600">{vesselHistory.error}</div>
          )}
          {vesselHistory?.vesselStages?.length === 0 && (
            <div className="text-sm text-slate-500 italic">
              {t('vfBindNoStages')}
            </div>
          )}
          {vesselHistory?.vesselStages?.length > 0 && (
            <div className="space-y-0">
              {vesselHistory.vesselStages.map((st, i) => {
                const isCurrent = st.isCurrent;
                const isDone = st.status === 'done';
                const dot = isCurrent
                  ? 'bg-blue-500 ring-4 ring-blue-200'
                  : isDone
                  ? 'bg-emerald-500'
                  : 'bg-slate-300';
                const txt = isCurrent
                  ? 'text-blue-700'
                  : isDone
                  ? 'text-emerald-700'
                  : 'text-slate-500';
                const line = isDone ? 'bg-emerald-300' : 'bg-slate-200';
                return (
                  <div key={st.stageId} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full ${dot} flex items-center justify-center`}>
                        {isDone ? (
                          <CheckCircle size={14} weight="fill" className="text-white" />
                        ) : (
                          <Boat size={12} weight={isCurrent ? 'fill' : 'regular'} className="text-white" />
                        )}
                      </div>
                      {i < vesselHistory.vesselStages.length - 1 && (
                        <div className={`flex-1 w-0.5 my-1 ${line}`} style={{ minHeight: '2rem' }} />
                      )}
                    </div>
                    <div className="flex-1 pb-5">
                      <div className="flex items-baseline gap-2">
                        <div className={`font-semibold ${txt}`}>{st.label}</div>
                        {isCurrent && (
                          <span className="text-[10px] uppercase tracking-wider text-blue-600 font-bold">{t('vfStageActive')}</span>
                        )}
                        {isDone && (
                          <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">{t('vfStageDone')}</span>
                        )}
                      </div>
                      {(st.from || st.to) && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {st.from} <span className="mx-1">→</span> {st.to}
                        </div>
                      )}
                      <div className="text-[11px] flex flex-wrap gap-1.5 mt-1">
                        {st.vessel?.name && (
                          <span className="font-mono bg-sky-50 text-sky-800 border border-sky-100 px-1.5 py-0.5 rounded">
                            ⚓ {st.vessel.name}
                          </span>
                        )}
                        {st.vessel?.mmsi && (
                          <span className="font-mono bg-slate-50 text-slate-600 border border-slate-100 px-1.5 py-0.5 rounded">
                            MMSI {st.vessel.mmsi}
                          </span>
                        )}
                        {st.vessel?.imo && (
                          <span className="font-mono bg-slate-50 text-slate-600 border border-slate-100 px-1.5 py-0.5 rounded">
                            IMO {st.vessel.imo}
                          </span>
                        )}
                        {st.container?.number && (
                          <span className="font-mono bg-indigo-50 text-indigo-800 border border-indigo-100 px-1.5 py-0.5 rounded">
                            📦 {st.container.number}
                          </span>
                        )}
                      </div>
                      {(st.startedAt || st.completedAt) && (
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          {st.startedAt && <span>{t('adm3_4454f5463a')} {fmtAgo(st.startedAt)}</span>}
                          {st.completedAt && <span className="ml-3">{t('adm3_a63ec7aa83')} {fmtAgo(st.completedAt)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
