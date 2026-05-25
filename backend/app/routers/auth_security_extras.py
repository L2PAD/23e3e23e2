"""
auth_security_extras — per-user TOTP + admin OTP config + pending OTPs view
===========================================================================

Дополняет существующий admin_security.py новыми ROUTES, не ломая старых:

  GET  /api/me/2fa/status               — свой статус TOTP
  POST /api/me/2fa/setup                — выдаёт QR + secret (пендинг до verify)
  POST /api/me/2fa/verify               — подтверждает включение
  POST /api/me/2fa/disable              — выключает (требует текущий код)

  GET  /api/admin/security/team-lead-otp-config   — текущий реципиент
  PUT  /api/admin/security/team-lead-otp-config   — изменить
  GET  /api/admin/security/pending-otps           — живые OTP-коды для тимлидов
  GET  /api/admin/security/daily-reset-config     — статус (включено/выкл/время)
  PUT  /api/admin/security/daily-reset-config     — вкл/выкл
"""
from __future__ import annotations

import base64
import logging
from io import BytesIO
from typing import Any, Dict

import pyotp
import qrcode
from fastapi import APIRouter, Body, Depends, HTTPException

from security import require_admin, get_current_user

logger = logging.getLogger("bibi.auth_security_extras")


def _svc():
    from app.core.db_runtime import get_db
    from app.services.auth_policy import AuthPolicyService
    return AuthPolicyService(get_db())


# ============================================================ PER-USER TOTP

me_router = APIRouter(prefix="/api/me/2fa", tags=["me-2fa"])


def _scope(user: Dict[str, Any]) -> str:
    return f"user:{user.get('id') or user.get('email')}"


@me_router.get("/status")
async def me_2fa_status(user: Dict[str, Any] = Depends(get_current_user)):
    svc = _svc()
    doc = (await svc.admin_sec.get_state(_scope(user))) or {}
    return {
        "enabled": bool(doc.get("twofa_enabled")),
        "setupPending": bool(doc.get("twofa_secret") and not doc.get("twofa_enabled")),
        "available": True,
    }


@me_router.post("/setup")
async def me_2fa_setup(user: Dict[str, Any] = Depends(get_current_user)):
    """Generate fresh TOTP secret + QR. Activation happens after /verify.
    Only admin-role accounts may turn on TOTP — managers/team_leads use
    their own flows (daily-reset / email-OTP) and don't need it.
    """
    from app.services.auth_policy import is_admin_role
    if not is_admin_role(user.get("role")):
        raise HTTPException(status_code=403, detail="TOTP available only for admin role")
    svc = _svc()
    secret = pyotp.random_base32()
    issuer = "BIBI Cars CRM"
    account = user.get("email") or _scope(user)
    uri = pyotp.TOTP(secret).provisioning_uri(name=account, issuer_name=issuer)
    img = qrcode.make(uri)
    buf = BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()
    await svc.admin_sec.record_setup_pending(_scope(user), secret=secret)
    return {
        "secret": secret,
        "qrCode": f"data:image/png;base64,{qr_b64}",
        "uri": uri,
        "issuer": issuer,
        "account": account,
    }


@me_router.post("/verify")
async def me_2fa_verify(
    payload: Dict[str, Any] = Body(...),
    user: Dict[str, Any] = Depends(get_current_user),
):
    code = str(payload.get("code") or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="code required")
    svc = _svc()
    doc = (await svc.admin_sec.get_state(_scope(user))) or {}
    secret = doc.get("twofa_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="2FA setup not started")
    if not pyotp.TOTP(secret).verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code")
    await svc.admin_sec.mark_enabled(_scope(user))
    return {"success": True, "enabled": True}


@me_router.post("/disable")
async def me_2fa_disable(
    payload: Dict[str, Any] = Body(default={}),
    user: Dict[str, Any] = Depends(get_current_user),
):
    svc = _svc()
    doc = (await svc.admin_sec.get_state(_scope(user))) or {}
    code = str((payload or {}).get("code") or "").strip()
    if doc.get("twofa_enabled"):
        secret = doc.get("twofa_secret")
        if not code or not pyotp.TOTP(secret).verify(code, valid_window=1):
            raise HTTPException(status_code=400, detail="Invalid code")
    await svc.admin_sec.clear_2fa(_scope(user))
    return {"success": True, "enabled": False}


# =========================================== ADMIN-ONLY: team_lead OTP config

admin_extra_router = APIRouter(
    prefix="/api/admin/security",
    tags=["admin-security-extras"],
    dependencies=[Depends(require_admin)],
)


@admin_extra_router.get("/team-lead-otp-config")
async def get_otp_config():
    svc = _svc()
    email = await svc.get_team_lead_otp_recipient()
    return {"recipient_email": email}


@admin_extra_router.put("/team-lead-otp-config")
async def put_otp_config(payload: Dict[str, Any] = Body(...)):
    email = (payload.get("recipient_email") or "").strip().lower()
    if email and "@" not in email:
        raise HTTPException(status_code=400, detail="recipient_email must be a valid email")
    svc = _svc()
    await svc.set_team_lead_otp_recipient(email or None)
    return {"success": True, "recipient_email": email or None}


@admin_extra_router.get("/pending-otps")
async def list_pending_otps(limit: int = 25):
    """Admin reads the active team-lead OTP codes. THIS IS THE FALLBACK
    that lets the system work without an SMTP integration: the admin
    sees the code in the UI and forwards it to the team-lead by phone
    or messenger."""
    svc = _svc()
    return {"data": await svc.otp.list_pending_for_admin(limit=limit)}


@admin_extra_router.get("/daily-reset-config")
async def get_daily_reset_config():
    svc = _svc()
    enabled = await svc.get_manager_daily_reset_enabled()
    return {
        "enabled": enabled,
        "hour_local": 12,
        "timezone": "Europe/Sofia",
        "applies_to": ["manager"],
    }


@admin_extra_router.put("/daily-reset-config")
async def put_daily_reset_config(payload: Dict[str, Any] = Body(...)):
    enabled = bool(payload.get("enabled", True))
    svc = _svc()
    await svc._settings_set("manager_daily_reset_enabled", enabled)
    return {"success": True, "enabled": enabled}
