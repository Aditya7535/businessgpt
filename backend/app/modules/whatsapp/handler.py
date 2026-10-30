import logging
from typing import Optional, List
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.auth import verify_pin
from app.models.user import User
from app.modules.whatsapp.session import (
    get_or_create_session,
    add_message,
    get_session_id,
    register_number,
    get_authorized_user_by_phone,
    link_phone_to_user,
    normalize_phone_number
)
from app.modules.whatsapp.formatter import (
    format_for_whatsapp,
    split_long_message,
    format_health_score,
    format_alerts,
    format_forecast,
    format_low_stock,
    format_welcome,
    format_unlinked_onboarding
)

logger = logging.getLogger(__name__)

COMMANDS = {'/health', '/alerts', '/forecast', '/stock', '/report', '/help', '/start'}


def _send_twilio_message(to: str, body: str, from_number: Optional[str] = None):
    """
    Send a WhatsApp message via Twilio SDK with safe error logging.
    Ensures 'whatsapp:' URI prefix on both destination and sender.
    """
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.info("[Twilio] Outbound send skipped: Twilio credentials not configured.")
        return

    to_addr = to.strip()
    if not to_addr.startswith("whatsapp:"):
        to_addr = f"whatsapp:{to_addr}"

    from_addr = (from_number or settings.TWILIO_WHATSAPP_FROM or settings.TWILIO_WHATSAPP_NUMBER or "whatsapp:+14155238886").strip()
    if not from_addr.startswith("whatsapp:"):
        from_addr = f"whatsapp:{from_addr}"

    # If the user mistakenly set their own personal phone number as the Twilio sender number
    if from_addr.lower() == to_addr.lower():
        logger.warning(
            f"[Twilio] Sender and recipient are identical ({from_addr}). "
            "Falling back to Twilio Sandbox sender whatsapp:+14155238886."
        )
        from_addr = "whatsapp:+14155238886"

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(body=body, from_=from_addr, to=to_addr)
        logger.info(f"Twilio message sent to {to_addr[:15]}... SID: {msg.sid}")
        return msg.sid
    except Exception as e:
        logger.error(f"Twilio send error to {to_addr[:15]}...: {str(e)[:150]}")
        raise e


def send_whatsapp_message(to: str, text: str, from_number: Optional[str] = None):
    """
    Split long messages according to WhatsApp limits and deliver each chunk.
    """
    chunks = split_long_message(text)
    for chunk in chunks:
        _send_twilio_message(to, chunk, from_number)


async def handle_link_command(clean_phone: str, command_text: str, db: Session) -> str:
    """
    Verifies owner/manager PIN to securely link a WhatsApp phone number.
    Command format: LINK <PIN>
    """
    parts = command_text.strip().split()
    if len(parts) < 2:
        return "⚠️ Please provide your 4-digit store PIN to link. Example: `LINK 1111`"

    pin_candidate = parts[1].strip()
    users = db.query(User).all()
    matched_user: Optional[User] = None

    for u in users:
        if verify_pin(pin_candidate, u.pin):
            matched_user = u
            break

    if not matched_user:
        return "❌ Galat PIN. Store account verify nahi ho paya. Please check your PIN and try again."

    link_phone_to_user(db, clean_phone, matched_user.id, opt_in_digest=True, opt_in_alerts=True)
    return (
        f"🎉 *Badhai ho! Link Successful!*\n\n"
        f"Aapka WhatsApp number (*{clean_phone}*) BusinessGPT store account *{matched_user.name}* ({matched_user.role}) se successfully link ho gaya hai.\n\n"
        f"Ab aap live store sales, stock, aur daily reports direct WhatsApp par access kar sakte hain. Shuru karne ke liye `/help` type karein ya koi bhi sawal poochhein! 🙏"
    )


async def handle_command(command: str, db: Session, user: Optional[User], clean_phone: str) -> str:
    """Process slash commands and return formatted response."""
    cmd = command.strip().lower().split()[0]

    if cmd in ('/help', '/start'):
        return format_welcome(clean_phone, user.name if user else None)

    # Store commands require an authorized user
    if not user and cmd in ('/health', '/alerts', '/forecast', '/stock', '/report'):
        return format_unlinked_onboarding(clean_phone)

    if cmd == '/health':
        try:
            from app.modules.health.scorer import compute_health_score
            health = compute_health_score(db)
            return format_health_score(health)
        except Exception as e:
            logger.error(f"Health score error: {e}")
            return f"⚠️ Health score load nahi hua: {str(e)[:80]}"

    elif cmd == '/alerts':
        try:
            from app.modules.alerts.checker import run_all_checks
            from app.models.alert import Alert
            alerts = db.query(Alert).filter(Alert.is_read == False).limit(10).all()
            alert_list = [{"message": a.message, "severity": a.severity, "type": a.alert_type} for a in alerts]
            if not alert_list:
                live = run_all_checks(db)
                alert_list = live[:5]
            return format_alerts(alert_list)
        except Exception as e:
            logger.error(f"Alerts load error: {e}")
            return f"⚠️ Alerts load nahi hue: {str(e)[:80]}"

    elif cmd == '/forecast':
        try:
            from app.modules.forecasting.engine import run_forecast
            result = run_forecast(db=db, horizon='week')
            return format_forecast(result)
        except Exception as e:
            logger.error(f"Forecast error: {e}")
            return f"⚠️ Forecast error: {str(e)[:80]}"

    elif cmd == '/stock':
        try:
            from app.api.inventory import get_inventory_summary
            inv_summary = get_inventory_summary(db)
            return format_low_stock(inv_summary)
        except Exception as e:
            logger.error(f"Inventory error: {e}")
            return f"⚠️ Stock summary error: {str(e)[:80]}"

    elif cmd == '/report':
        url = f"{settings.FRONTEND_URL.rstrip('/')}/reports"
        return (
            "📄 *BusinessGPT Store Report*\n\n"
            "Report download karne ke liye:\n"
            f"1. BusinessGPT web dashboard kholein: {url}\n"
            "2. 'Reports' tab mein jakar Daily ya Monthly PDF generate karein.\n\n"
            "PDF turant download ho jayegi! 📥"
        )

    return f"❓ Unknown command: {cmd}\nType `/help` for available commands."


async def process_message(phone_number: str, message_text: str, db: Session) -> list[str]:
    """
    Main entry point: process incoming WhatsApp message and return natural Hinglish response(s).
    Enforces owner-to-store authentication mapping:
    - If user is authorized, provides full BusinessGPT consultant reasoning and store database execution.
    - If user is not authorized, general questions are answered safely, while store-specific queries
      receive an onboarding message rather than exposing store data.
    """
    clean_phone = normalize_phone_number(phone_number)
    text = (message_text or "").strip()
    logger.info(f"WhatsApp incoming from {clean_phone}: {text[:80]}")

    if not text:
        return ["Namaste! Main BusinessGPT hoon. Koi sawaal poochhein ya `/help` type karein."]

    # Record user message in conversational history
    add_message(db, clean_phone, "user", text)

    # 1. Resolve sender to authorized BusinessGPT account
    user = get_authorized_user_by_phone(db, clean_phone)

    # 2. Account linking command: LINK <PIN>
    if text.lower().startswith("link ") or text.lower().startswith("/link "):
        response = await handle_link_command(clean_phone, text, db)
        add_message(db, clean_phone, "assistant", response)
        return split_long_message(response)

    # 3. Slash command handling
    if text.startswith("/"):
        response = await handle_command(text, db, user, clean_phone)
        add_message(db, clean_phone, "assistant", response)
        return split_long_message(response)

    # 4. Join / Sandbox opt-in command
    if text.lower().startswith("join "):
        register_number(db, clean_phone)
        welcome = format_welcome(clean_phone, user.name if user else None)
        add_message(db, clean_phone, "assistant", welcome)
        return [welcome]

    # 5. Check intent for store data authorization
    from app.modules.orchestrator.intent import classify_intent
    intent = classify_intent(text)

    # If asking for private store data (sales, inventory, stock, forecast, health, alerts, inventory adjustments)
    # but the sender is NOT linked to an authorized user:
    if not user and intent in ("sql", "inventory", "forecasting", "health", "alerts", "inventory_adjustment"):
        onboarding = format_unlinked_onboarding(clean_phone)
        add_message(db, clean_phone, "assistant", onboarding)
        return split_long_message(onboarding)

    # 6. Conversational AI Reasoning via LangGraph Orchestrator
    try:
        from app.modules.orchestrator.graph import app_graph
        session_id = get_session_id(clean_phone)
        result = app_graph.invoke({
            "query": text,
            "session_id": session_id,
            "store_id": 1,
            "user_id": user.id if user else None,
            "source": "whatsapp"
        })
        
        # Extract response from orchestrator graph
        raw_response = result.get("final_response") or result.get("response") or "Kuch samajh nahi aaya. Dobara poochho."
        formatted = format_for_whatsapp(raw_response)
    except Exception as e:
        logger.error(f"Orchestrator error for {clean_phone}: {e}")
        formatted = "⚠️ Server thoda busy hai. Kripya 1 minute baad dobara koshish karein."

    add_message(db, clean_phone, "assistant", formatted)
    return split_long_message(formatted)
