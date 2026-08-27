import logging
from sqlalchemy.orm import Session

from app.modules.whatsapp.session import (
    get_or_create_session, add_message, get_session_id, register_number
)
from app.modules.whatsapp.formatter import (
    format_for_whatsapp, split_long_message, format_health_score,
    format_alerts, format_forecast, format_low_stock, format_welcome
)

logger = logging.getLogger(__name__)

# ─── Slash commands ───────────────────────────────────────
COMMANDS = {'/health', '/alerts', '/forecast', '/stock', '/report', '/help', '/start'}


def _send_twilio_message(to: str, body: str, from_number: str):
    """Send a WhatsApp message via Twilio."""
    try:
        from twilio.rest import Client
        from app.core.config import settings
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(body=body, from_=from_number, to=to)
    except Exception as e:
        logger.error(f"Twilio send error to {to}: {e}")


def send_whatsapp_message(to: str, text: str, from_number: str):
    """
    Split long messages and send each chunk via Twilio.
    `to` and `from_number` must be in format whatsapp:+XXXXXXXXXX
    """
    chunks = split_long_message(text)
    for chunk in chunks:
        _send_twilio_message(to, chunk, from_number)


async def handle_command(command: str, db: Session) -> str:
    """Process slash commands and return formatted response."""
    cmd = command.strip().lower().split()[0]

    if cmd in ('/help', '/start'):
        return format_welcome('')

    elif cmd == '/health':
        try:
            from app.modules.health.scorer import compute_health_score
            health = compute_health_score(db)
            return format_health_score(health)
        except Exception as e:
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
            return f"⚠️ Alerts load nahi hue: {str(e)[:80]}"

    elif cmd == '/forecast':
        try:
            from app.modules.forecasting.engine import run_forecast
            from app.core.database import SessionLocal
            from app.models.dataset import Dataset
            _db = db
            latest = _db.query(Dataset).order_by(Dataset.id.desc()).first()
            if not latest:
                return "⚠️ Pehle data upload karein!"
            result = run_forecast(latest.data, horizon='week')
            return format_forecast(result)
        except Exception as e:
            return f"⚠️ Forecast error: {str(e)[:80]}"

    elif cmd == '/stock':
        try:
            from app.modules.inventory.engine import analyze_all_products
            from app.modules.inventory.router import _detect_col
            from app.models.dataset import Dataset
            latest = db.query(Dataset).order_by(Dataset.id.desc()).first()
            if not latest:
                return "⚠️ Pehle data upload karein!"
            cols = list(latest.data[0].keys())
            date_col = _detect_col(cols, ['date', 'order_date', 'invoice_date', 'month'])
            sales_col = _detect_col(cols, ['sales', 'revenue', 'quantity', 'units', 'amount'])
            product_col = _detect_col(cols, ['product', 'item', 'sku', 'category'])
            analysis = analyze_all_products(latest.data, date_col, sales_col, product_col)
            return format_low_stock({'analysis': analysis})
        except Exception as e:
            return f"⚠️ Inventory error: {str(e)[:80]}"

    elif cmd == '/report':
        return (
            "📄 *Report Generate Karo*\n\n"
            "Report generate karne ke liye:\n"
            "1. BusinessGPT web app kholein: http://localhost:3000/reports\n"
            "2. 'Download Monthly Report' pe click karein\n\n"
            "PDF download ho jayega! 📥"
        )

    return f"❓ Unknown command: {cmd}\nType /help for available commands."


async def process_message(phone_number: str, message_text: str, db: Session) -> list[str]:
    """
    Main entry point: process incoming WhatsApp message and return response(s).
    """
    text = message_text.strip()
    logger.info(f"WhatsApp message from {phone_number}: {text[:80]}")

    # Save user message to session
    add_message(db, phone_number, "user", text)

    # ── Slash command ──────────────────────────────────────
    if text.startswith('/'):
        response = await handle_command(text, db)
        add_message(db, phone_number, "assistant", response)
        return split_long_message(response)

    # ── Join / registration message ────────────────────────
    if text.lower().startswith('join '):
        register_number(db, phone_number)
        welcome = format_welcome(phone_number)
        add_message(db, phone_number, "assistant", welcome)
        return [welcome]

    # ── Regular chat → LangGraph orchestrator ─────────────
    try:
        from app.modules.orchestrator.graph import app_graph
        session_id = get_session_id(phone_number)
        result = app_graph.invoke({"query": text, "session_id": session_id})
        raw_response = result.get("response", "Kuch samajh nahi aaya. Dobara poochho.")
        formatted = format_for_whatsapp(raw_response)
    except Exception as e:
        logger.error(f"Orchestrator error for {phone_number}: {e}")
        formatted = "⚠️ Abhi server busy hai. Thodi der baad try karein."

    add_message(db, phone_number, "assistant", formatted)
    return split_long_message(formatted)
