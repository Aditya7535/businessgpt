import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.modules.whatsapp.handler import process_message, send_whatsapp_message
from app.modules.whatsapp.session import (
    register_number,
    link_phone_to_user,
    is_message_duplicate,
    log_message,
    normalize_phone_number,
    get_authorized_user_by_phone,
    get_all_registered_numbers
)
from app.modules.whatsapp.formatter import format_welcome

logger = logging.getLogger(__name__)

# Router mounted at /api/whatsapp in main.py
router = APIRouter()


def verify_twilio_signature(request: Request, form_dict: dict) -> bool:
    """
    Validates Twilio X-Twilio-Signature header using the official Twilio SDK RequestValidator.
    Supports reverse-proxy headers (x-forwarded-proto, x-forwarded-host) and
    configurable WHATSAPP_WEBHOOK_BASE_URL.
    """
    if not settings.TWILIO_AUTH_TOKEN:
        logger.warning("[Twilio Security] Webhook rejected: TWILIO_AUTH_TOKEN is not configured.")
        return False

    signature = request.headers.get("X-Twilio-Signature")
    if not signature:
        logger.warning("[Twilio Security] Webhook rejected: Missing X-Twilio-Signature header.")
        return False

    try:
        from twilio.request_validator import RequestValidator
        validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)

        candidate_urls = []

        # 1. Direct request URL as seen by ASGI
        candidate_urls.append(str(request.url))

        # 2. Reconstructed URL with reverse-proxy forwarded headers
        proto = request.headers.get("x-forwarded-proto") or request.url.scheme
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        if host:
            path_and_query = request.url.path + (f"?{request.url.query}" if request.url.query else "")
            candidate_urls.append(f"{proto}://{host}{path_and_query}")

        # 3. Explicitly configured webhook base URL (e.g. ngrok or production domain)
        if settings.WHATSAPP_WEBHOOK_BASE_URL:
            base = settings.WHATSAPP_WEBHOOK_BASE_URL.rstrip('/')
            candidate_urls.append(f"{base}/api/whatsapp/webhook")
            candidate_urls.append(f"{base}/api/whatsapp/webhook/")

        # Validate against candidate URLs
        for url in candidate_urls:
            if validator.validate(url, form_dict, signature):
                return True

        logger.warning(f"[Twilio Security] Signature mismatch against candidates: {candidate_urls}")
        return False

    except Exception as e:
        logger.error(f"[Twilio Security] Error validating Twilio signature: {e}")
        return False


# ─── 1. Twilio Incoming Webhook ──────────────────────────────
@router.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
    Body: str = Form(default=''),
    From: str = Form(default=''),
    To: str = Form(default=''),
    MessageSid: str = Form(default=''),
    SmsSid: str = Form(default='')
):
    """
    Receives incoming WhatsApp messages from Twilio.
    - Validates X-Twilio-Signature via official Twilio RequestValidator.
    - Idempotent: Skips duplicate deliveries using MessageSid deduplication.
    - Routes message through BusinessGPT conversational engine.
    - Sends response chunk(s) back via Twilio WhatsApp service.
    """
    if not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_ACCOUNT_SID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WhatsApp service is not configured. TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required."
        )

    form_data = await request.form()
    form_dict = {key: str(value) for key, value in form_data.items()}

    # Cryptographic signature validation
    if not verify_twilio_signature(request, form_dict):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Twilio webhook signature."
        )

    # Idempotency check: prevent duplicate processing on webhook retries
    effective_sid = MessageSid or SmsSid or form_dict.get("SmsMessageSid", "")
    if effective_sid and is_message_duplicate(db, effective_sid):
        logger.info(f"[Twilio Webhook] Duplicate MessageSid {effective_sid} skipped.")
        return PlainTextResponse("OK")

    clean_phone = normalize_phone_number(From)
    message_text = Body.strip()

    if not clean_phone or not message_text:
        return PlainTextResponse("OK")

    logger.info(f"[Twilio Webhook] Processing message from {clean_phone} (SID: {effective_sid})")

    try:
        # Process through BusinessGPT engine with owner authorization check
        responses = await process_message(clean_phone, message_text, db)

        # Dispatch back via Twilio
        from_number = settings.TWILIO_WHATSAPP_FROM or settings.TWILIO_WHATSAPP_NUMBER or To
        for response_chunk in responses:
            send_whatsapp_message(
                to=clean_phone,
                text=response_chunk,
                from_number=from_number
            )

        # Log processed message for idempotency
        if effective_sid:
            log_message(db, effective_sid, clean_phone, direction="inbound", body=message_text)

    except Exception as e:
        logger.error(f"[Twilio Webhook] Error processing message: {e}", exc_info=True)

    return PlainTextResponse("OK")


# ─── 2. Service Status ───────────────────────────────────────
@router.get("/status")
def get_whatsapp_status(db: Session = Depends(get_db)):
    """
    Returns WhatsApp service integration status without exposing credentials.
    """
    is_configured = bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN)
    subscribers_count = len(get_all_registered_numbers(db))
    
    return {
        "configured": is_configured,
        "whatsapp_from": settings.TWILIO_WHATSAPP_FROM if is_configured else None,
        "daily_digest_enabled": settings.WHATSAPP_DAILY_DIGEST_ENABLED,
        "daily_digest_time": settings.WHATSAPP_DAILY_DIGEST_TIME,
        "store_timezone": settings.WHATSAPP_STORE_TIMEZONE,
        "webhook_url": f"{settings.WHATSAPP_WEBHOOK_BASE_URL.rstrip('/')}/api/whatsapp/webhook" if settings.WHATSAPP_WEBHOOK_BASE_URL else None,
        "active_subscribers": subscribers_count
    }


# ─── 3. Account Linking & Registration ───────────────────────
class LinkRequest(BaseModel):
    phone_number: str = Field(..., description="E.164 phone number e.g. +919876543210")
    opt_in_digest: bool = True
    opt_in_alerts: bool = True


@router.post("/link")
def link_authenticated_user_phone(
    payload: LinkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Securely links the currently logged-in BusinessGPT user (owner/manager)
    to a WhatsApp phone number.
    """
    clean_phone = normalize_phone_number(payload.phone_number)
    if not clean_phone.startswith("+"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number must start with country code, e.g. +919876543210"
        )

    reg = link_phone_to_user(
        db=db,
        phone_number=clean_phone,
        user_id=current_user.id,
        opt_in_digest=payload.opt_in_digest,
        opt_in_alerts=payload.opt_in_alerts
    )

    # Optional welcome message if Twilio is configured
    try:
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            send_whatsapp_message(
                to=clean_phone,
                text=format_welcome(clean_phone, current_user.name)
            )
    except Exception as e:
        logger.warning(f"Could not send welcome WhatsApp to {clean_phone}: {e}")

    return {
        "status": "linked",
        "phone_number": clean_phone,
        "user_id": current_user.id,
        "user_name": current_user.name,
        "role": current_user.role,
        "opt_in_digest": reg.opt_in_digest,
        "opt_in_alerts": reg.opt_in_alerts,
        "message": f"Successfully linked {clean_phone} to {current_user.name}."
    }


# ─── 4. Update Notification Preferences ─────────────────────
class PreferencesRequest(BaseModel):
    opt_in_digest: Optional[bool] = None
    opt_in_alerts: Optional[bool] = None


@router.post("/preferences")
def update_preferences(
    payload: PreferencesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update notification preferences for the logged-in user's phone."""
    from app.models.whatsapp import WhatsAppRegistration
    reg = db.query(WhatsAppRegistration).filter(
        WhatsAppRegistration.user_id == current_user.id
    ).first()

    if not reg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No WhatsApp registration found for this user. Please link your phone number first."
        )

    if payload.opt_in_digest is not None:
        reg.opt_in_digest = payload.opt_in_digest
    if payload.opt_in_alerts is not None:
        reg.opt_in_alerts = payload.opt_in_alerts

    db.commit()
    db.refresh(reg)

    return {
        "status": "updated",
        "phone_number": reg.phone_number,
        "opt_in_digest": reg.opt_in_digest,
        "opt_in_alerts": reg.opt_in_alerts
    }


# ─── 5. Legacy Register Route (For backwards compatibility) ──
class RegisterRequest(BaseModel):
    phone_number: str


@router.post("/register")
async def register_whatsapp(request: RegisterRequest, db: Session = Depends(get_db)):
    """Legacy registration endpoint."""
    clean_phone = normalize_phone_number(request.phone_number)
    if not clean_phone.startswith('+'):
        raise HTTPException(
            status_code=400,
            detail="Phone number must start with country code, e.g. +919876543210"
        )

    is_new = register_number(db, clean_phone)
    return {
        "status": "registered" if is_new else "already_registered",
        "phone_number": clean_phone,
        "message": "Phone number registered for WhatsApp notifications."
    }


# ─── 6. Broadcast Alert to Registered Numbers ────────────────
@router.post("/broadcast")
async def broadcast_alert(
    message: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send an alert message to all registered WhatsApp numbers."""
    numbers = get_all_registered_numbers(db)
    if not numbers:
        return {"sent": 0, "message": "No registered WhatsApp numbers."}

    sent = 0
    for phone in numbers:
        try:
            send_whatsapp_message(to=phone, text=message)
            sent += 1
        except Exception as e:
            logger.error(f"Failed to send broadcast to {phone}: {e}")

    return {
        "sent": sent,
        "total": len(numbers),
        "message": f"Broadcast sent to {sent}/{len(numbers)} numbers."
    }


# ─── 7. Test Message Endpoint (Local Dev / Offline Testing) ──
@router.post("/test")
async def test_message(
    message: str,
    phone: str = "+919876543210",
    db: Session = Depends(get_db)
):
    """Test the complete message handler without invoking Twilio network."""
    responses = await process_message(phone, message, db)
    return {"phone": phone, "message": message, "responses": responses}
