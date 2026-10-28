import logging
from datetime import datetime, date, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal
from app.modules.alerts.checker import run_all_checks, save_alerts_to_db

logger = logging.getLogger("businessgpt.scheduler")

# Timezone-aware scheduler initialized with store timezone
scheduler = BackgroundScheduler(timezone=settings.WHATSAPP_STORE_TIMEZONE)


def _daily_alert_job():
    """Evaluates business rules, detects low stock and revenue anomalies, and saves to database."""
    db: Session = SessionLocal()
    try:
        alerts = run_all_checks(db)
        save_alerts_to_db(db, alerts)
        logger.info(f"[Scheduler] Daily alerts generated: {len(alerts)} alerts saved to database.")
    except Exception as e:
        logger.error(f"[Scheduler] Error in daily alert job: {e}")
    finally:
        db.close()


def send_store_daily_digest(db: Session, force: bool = False):
    """
    Constructs and sends the morning business briefing to all opted-in WhatsApp subscribers.
    - Uses strictly authentic store data from PostgreSQL/SQLite.
    - Enforces idempotency via last_digest_date tracking (no duplicate daily digests).
    - Checks opt_in_digest preferences.
    """
    if not settings.WHATSAPP_DAILY_DIGEST_ENABLED and not force:
        logger.info("[Scheduler] WhatsApp daily digest skipped (WHATSAPP_DAILY_DIGEST_ENABLED=false).")
        return 0

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.info("[Scheduler] WhatsApp daily digest skipped: Twilio credentials not configured.")
        return 0

    from app.modules.whatsapp.session import get_digest_subscribers, update_subscriber_digest_date
    from app.modules.whatsapp.formatter import format_daily_digest
    from app.modules.whatsapp.handler import send_whatsapp_message
    from app.models.product import Product
    from app.models.store_setting import StoreSetting

    subscribers = get_digest_subscribers(db)
    if not subscribers:
        logger.info("[Scheduler] No opted-in WhatsApp subscribers found for daily digest.")
        return 0

    today_str = datetime.now().strftime("%Y-%m-%d")
    date_display = datetime.now().strftime("%A, %d %B %Y")

    # 1. Fetch store name
    store_name = "Bharat General Store & Supermart"
    try:
        setting = db.query(StoreSetting).filter(StoreSetting.key == "business_name").first()
        if setting and setting.value:
            store_name = setting.value.strip('"')
    except Exception:
        pass

    # 2. Calculate actual sales performance (yesterday or latest available window)
    sales_info = {"revenue": 0.0, "units": 0, "profit": 0.0}
    try:
        # Check sales from yesterday or today
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        row = db.execute(text("""
            SELECT 
                COALESCE(SUM(revenue), 0) as rev,
                COALESCE(SUM(quantity_sold), 0) as units,
                COALESCE(SUM(revenue - cost), 0) as profit
            FROM sales_data
            WHERE date >= :yesterday AND date <= :today
        """), {"yesterday": yesterday, "today": today_str}).first()

        if row and (row[0] or row[1]):
            sales_info = {"revenue": float(row[0]), "units": int(row[1]), "profit": float(row[2])}
        else:
            # Fallback to latest available sales date in database
            latest_date_row = db.execute(text("SELECT MAX(date) FROM sales_data")).scalar()
            if latest_date_row:
                latest_str = str(latest_date_row)[:10]
                row_latest = db.execute(text("""
                    SELECT 
                        COALESCE(SUM(revenue), 0) as rev,
                        COALESCE(SUM(quantity_sold), 0) as units,
                        COALESCE(SUM(revenue - cost), 0) as profit
                    FROM sales_data
                    WHERE date = :latest_date
                """), {"latest_date": latest_str}).first()
                if row_latest:
                    sales_info = {"revenue": float(row_latest[0]), "units": int(row_latest[1]), "profit": float(row_latest[2])}
    except Exception as e:
        logger.warning(f"[Scheduler] Could not calculate digest sales info: {e}")

    # 3. Calculate actual inventory shortage counts
    crit_count = 0
    low_count = 0
    try:
        products = db.query(Product).all()
        for p in products:
            if p.current_stock <= max(1, p.reorder_point // 3):
                crit_count += 1
            elif p.current_stock <= p.reorder_point:
                low_count += 1
    except Exception as e:
        logger.warning(f"[Scheduler] Could not calculate inventory shortage counts: {e}")

    # 4. Compute Health Score
    health_score = None
    health_grade = None
    try:
        from app.modules.health.scorer import compute_health_score
        h_res = compute_health_score(db)
        health_score = h_res.get("total_score")
        health_grade = h_res.get("grade")
    except Exception as e:
        logger.warning(f"[Scheduler] Could not compute health score: {e}")

    # 5. Seasonal Opportunity / Tip
    tip = "Diwali and festive demand surges 30-40% across FMCG items — check stock buffers today!"
    try:
        from app.modules.market_intel.calendar import get_active_month_opportunity
        opp = get_active_month_opportunity()
        if opp and opp.get("key_event"):
            tip = f"{opp['key_event']}: High demand expected for {opp.get('high_demand_categories', ['FMCG'])[0]}."
    except Exception:
        pass

    # Construct the digest message
    digest_text = format_daily_digest(
        store_name=store_name,
        date_str=date_display,
        sales_info=sales_info,
        low_stock_count=low_count,
        critical_stock_count=crit_count,
        health_score=health_score,
        health_grade=health_grade,
        tip_or_seasonal=tip
    )

    sent_count = 0
    for sub in subscribers:
        # Enforce duplicate prevention: only one daily digest per calendar date
        if sub.last_digest_date == today_str and not force:
            logger.info(f"[Scheduler] Daily digest already sent to {sub.phone_number} on {today_str}. Skipping.")
            continue

        try:
            send_whatsapp_message(to=sub.phone_number, text=digest_text)
            update_subscriber_digest_date(db, sub.phone_number, today_str)
            sent_count += 1
            logger.info(f"[Scheduler] Daily digest delivered to {sub.phone_number}.")
        except Exception as e:
            logger.error(f"[Scheduler] Failed to deliver daily digest to {sub.phone_number}: {e}")

    return sent_count


def _daily_whatsapp_digest_job():
    """Runs each morning to deliver the BusinessGPT Daily Digest."""
    db: Session = SessionLocal()
    try:
        sent = send_store_daily_digest(db)
        logger.info(f"[Scheduler] WhatsApp daily digest job finished. Delivered to {sent} subscribers.")
    except Exception as e:
        logger.error(f"[Scheduler] Error executing WhatsApp daily digest job: {e}")
    finally:
        db.close()


def start_scheduler():
    """Starts background scheduler and registers cron triggers."""
    if not scheduler.running:
        # 1. Daily rule alerts at 8:00 AM
        scheduler.add_job(
            _daily_alert_job,
            CronTrigger(hour=8, minute=0, timezone=settings.WHATSAPP_STORE_TIMEZONE),
            id="daily_alerts",
            replace_existing=True,
        )

        # 2. Daily WhatsApp briefing at configured time (default 09:00 AM)
        digest_hour = 9
        digest_minute = 0
        try:
            time_parts = settings.WHATSAPP_DAILY_DIGEST_TIME.split(":")
            digest_hour = int(time_parts[0])
            digest_minute = int(time_parts[1]) if len(time_parts) > 1 else 0
        except Exception as e:
            logger.warning(f"[Scheduler] Invalid WHATSAPP_DAILY_DIGEST_TIME '{settings.WHATSAPP_DAILY_DIGEST_TIME}', defaulting to 09:00.")

        scheduler.add_job(
            _daily_whatsapp_digest_job,
            CronTrigger(hour=digest_hour, minute=digest_minute, timezone=settings.WHATSAPP_STORE_TIMEZONE),
            id="daily_whatsapp_digest",
            replace_existing=True,
        )

        scheduler.start()
        logger.info(
            f"[Scheduler] APScheduler active. Daily alerts at 08:00, WhatsApp digest at "
            f"{digest_hour:02d}:{digest_minute:02d} ({settings.WHATSAPP_STORE_TIMEZONE})."
        )


def stop_scheduler():
    """Stops background scheduler cleanly at shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] APScheduler stopped.")
