import logging
from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.whatsapp.handler import process_message, send_whatsapp_message
from app.modules.whatsapp.session import register_number
from app.modules.whatsapp.formatter import format_welcome

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Twilio webhook (POST from Twilio) ──────────────────
@router.post("/whatsapp/webhook")
async def whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
    Body: str = Form(default=''),
    From: str = Form(default=''),
    To: str = Form(default=''),
):
    """
    Receives incoming WhatsApp messages from Twilio.
    Twilio sends: From=whatsapp:+91XXXXXXXXXX, Body=<message text>
    """
    if not From or not Body:
        return PlainTextResponse("OK")

    phone_number = From  # e.g. "whatsapp:+919876543210"
    clean_phone = phone_number.replace('whatsapp:', '')

    logger.info(f"Incoming WhatsApp from {clean_phone}: {Body[:80]}")

    try:
        # Process and get response(s)
        responses = await process_message(clean_phone, Body, db)

        # Send each chunk back via Twilio
        from app.core.config import settings
        from_number = settings.TWILIO_WHATSAPP_NUMBER or To

        for response_text in responses:
            send_whatsapp_message(
                to=phone_number,
                text=response_text,
                from_number=from_number
            )
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")

    # Twilio expects a 200 OK (TwiML or empty)
    return PlainTextResponse("OK")


# ─── Register a phone number for proactive alerts ────────
class RegisterRequest(BaseModel):
    phone_number: str   # e.g. "+919876543210"


@router.post("/whatsapp/register")
async def register_whatsapp(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a phone number to receive proactive WhatsApp alerts.
    Also sends a welcome message to the number.
    """
    phone = request.phone_number.strip()
    if not phone.startswith('+'):
        raise HTTPException(status_code=400, detail="Phone number must start with country code, e.g. +919876543210")

    is_new = register_number(db, phone)

    # Send welcome message
    try:
        from app.core.config import settings
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
            send_whatsapp_message(
                to=f"whatsapp:{phone}",
                text=format_welcome(phone),
                from_number=settings.TWILIO_WHATSAPP_NUMBER
            )
    except Exception as e:
        logger.warning(f"Could not send welcome message to {phone}: {e}")

    return {
        "status": "registered" if is_new else "already_registered",
        "phone_number": phone,
        "message": f"{'Welcome! Registration successful.' if is_new else 'Already registered.'} Welcome message sent via WhatsApp."
    }


# ─── Send a manual alert to all registered numbers ──────
@router.post("/whatsapp/broadcast")
async def broadcast_alert(
    message: str,
    db: Session = Depends(get_db)
):
    """Send a custom alert message to all registered WhatsApp numbers."""
    from app.modules.whatsapp.session import get_all_registered_numbers
    from app.core.config import settings

    numbers = get_all_registered_numbers(db)
    if not numbers:
        return {"sent": 0, "message": "No registered numbers."}

    sent = 0
    for phone in numbers:
        try:
            send_whatsapp_message(
                to=f"whatsapp:{phone}",
                text=message,
                from_number=settings.TWILIO_WHATSAPP_NUMBER
            )
            sent += 1
        except Exception as e:
            logger.error(f"Failed to send to {phone}: {e}")

    return {"sent": sent, "total": len(numbers), "message": f"Alert sent to {sent}/{len(numbers)} numbers."}


# ─── Test endpoint (no Twilio needed) ───────────────────
@router.post("/whatsapp/test")
async def test_message(
    message: str,
    phone: str = "+919999999999",
    db: Session = Depends(get_db)
):
    """Test the message handler without sending via Twilio (dev only)."""
    responses = await process_message(phone, message, db)
    return {"phone": phone, "message": message, "responses": responses}
