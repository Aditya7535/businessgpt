from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.core.database import SessionLocal
from app.modules.alerts.checker import run_all_checks, save_alerts_to_db

scheduler = BackgroundScheduler(timezone="Asia/Kolkata")


def _send_whatsapp_alerts(alerts: list):
    """Send generated alerts to all registered WhatsApp numbers."""
    try:
        from app.core.config import settings
        if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
            return   # Twilio not configured — skip silently

        from app.modules.whatsapp.session import get_all_registered_numbers
        from app.modules.whatsapp.handler import send_whatsapp_message
        from app.modules.whatsapp.formatter import format_alerts

        db = SessionLocal()
        try:
            numbers = get_all_registered_numbers(db)
        finally:
            db.close()

        if not numbers or not alerts:
            return

        high_alerts = [a for a in alerts if a.get('severity') == 'HIGH']
        if not high_alerts:
            return

        message = format_alerts(high_alerts[:3])

        for phone in numbers:
            send_whatsapp_message(
                to=f"whatsapp:{phone}",
                text=message,
                from_number=settings.TWILIO_WHATSAPP_NUMBER
            )
        print(f"[Scheduler] WhatsApp alerts sent to {len(numbers)} numbers.")
    except Exception as e:
        print(f"[Scheduler] WhatsApp alert delivery error: {e}")


def _daily_alert_job():
    """Runs every morning at 8 AM IST."""
    db = SessionLocal()
    try:
        alerts = run_all_checks(db)
        save_alerts_to_db(db, alerts)
        print(f"[Scheduler] Daily alerts generated: {len(alerts)} alerts.")
        # Also push HIGH alerts via WhatsApp
        _send_whatsapp_alerts(alerts)
    except Exception as e:
        print(f"[Scheduler] Error in daily alert job: {e}")
    finally:
        db.close()


def start_scheduler():
    """Called at FastAPI startup."""
    if not scheduler.running:
        scheduler.add_job(
            _daily_alert_job,
            CronTrigger(hour=8, minute=0),   # 8:00 AM IST
            id="daily_alerts",
            replace_existing=True,
        )
        scheduler.start()
        print("[Scheduler] APScheduler started — daily alerts at 8 AM IST.")


def stop_scheduler():
    """Called at FastAPI shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[Scheduler] APScheduler stopped.")
