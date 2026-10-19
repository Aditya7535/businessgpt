from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.core.database import SessionLocal
from app.modules.alerts.checker import run_all_checks, save_alerts_to_db

scheduler = BackgroundScheduler(timezone="Asia/Kolkata")


def _daily_alert_job():
    """Runs every morning at 8 AM IST."""
    db = SessionLocal()
    try:
        alerts = run_all_checks(db)
        save_alerts_to_db(db, alerts)
        print(f"[Scheduler] Daily alerts generated: {len(alerts)} alerts.")
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
