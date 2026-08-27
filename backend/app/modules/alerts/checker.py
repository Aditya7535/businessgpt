from typing import List, Dict
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.dataset import Dataset


# ── Festival alert calendar ──
UPCOMING_FESTIVALS = {
    "Diwali": ["2024-11-01", "2025-10-20", "2026-11-08"],
    "Holi": ["2024-03-25", "2025-03-14", "2026-03-03"],
    "Eid": ["2024-04-10", "2025-03-30", "2026-03-20"],
    "Christmas": ["2024-12-25", "2025-12-25", "2026-12-25"],
    "Navratri": ["2024-10-03", "2025-09-22", "2026-10-11"],
    "Raksha_Bandhan": ["2024-08-19", "2025-08-09", "2026-08-29"],
}

FESTIVAL_ADVANCE_NOTICE_DAYS = 21   # Alert 3 weeks before


def _get_upcoming_festivals(within_days: int = FESTIVAL_ADVANCE_NOTICE_DAYS) -> List[Dict]:
    today = date.today()
    upcoming = []
    for festival, dates in UPCOMING_FESTIVALS.items():
        for d_str in dates:
            fest_date = date.fromisoformat(d_str)
            delta = (fest_date - today).days
            if 0 <= delta <= within_days:
                upcoming.append({"festival": festival, "date": d_str, "days_away": delta})
    return upcoming


def check_inventory_alerts(db: Session) -> List[Dict]:
    """Check inventory for critical/low stock alerts."""
    alerts = []
    latest = db.query(Dataset).order_by(Dataset.id.desc()).first()
    if not latest or not latest.data:
        return alerts

    try:
        from app.modules.inventory.engine import analyze_all_products
        from app.modules.inventory.router import _detect_col

        columns = list(latest.data[0].keys())
        date_col = _detect_col(columns, ["date", "order_date", "invoice_date", "month", "time"])
        sales_col = _detect_col(columns, ["sales", "revenue", "quantity", "units", "amount", "qty"])
        product_col = _detect_col(columns, ["product", "item", "sku", "category", "product_name"])

        if not date_col or not sales_col or not product_col:
            return alerts

        results = analyze_all_products(
            data=latest.data,
            date_col=date_col,
            sales_col=sales_col,
            product_col=product_col,
        )

        for item in results:
            if "error" in item:
                continue
            status = item.get("status")
            product = item.get("product", "Unknown")
            days = item.get("days_remaining", 0)

            if status == "CRITICAL":
                alerts.append({
                    "alert_type": "INVENTORY",
                    "severity": "HIGH",
                    "message": f"🚨 CRITICAL: {product} sirf {int(days)} din mein khatam hoga! Turant order karein.",
                })
            elif status == "LOW_STOCK":
                alerts.append({
                    "alert_type": "INVENTORY",
                    "severity": "MEDIUM",
                    "message": f"⚠️ LOW STOCK: {product} {int(days)} din mein khatam hoga.",
                })
    except Exception:
        pass

    return alerts


def check_festival_alerts() -> List[Dict]:
    """Check for upcoming Indian festivals."""
    alerts = []
    upcoming = _get_upcoming_festivals()

    for fest in upcoming:
        festival = fest["festival"].replace("_", " ")
        days = fest["days_away"]
        severity = "HIGH" if days <= 7 else "MEDIUM"
        alerts.append({
            "alert_type": "FESTIVAL",
            "severity": severity,
            "message": f"🎉 {festival} sirf {days} din baad hai! Pichle saal iss season mein sales 30-40% zyada thi. Stock badhaiye.",
        })

    return alerts


def check_revenue_alerts(db: Session) -> List[Dict]:
    """Check if current month revenue is on track."""
    alerts = []
    latest = db.query(Dataset).order_by(Dataset.id.desc()).first()
    if not latest or not latest.data:
        return alerts

    try:
        import pandas as pd
        from datetime import datetime

        df = pd.DataFrame(latest.data)
        columns = list(df.columns)

        from app.modules.inventory.router import _detect_col
        date_col = _detect_col(columns, ["date", "order_date", "invoice_date", "month", "time"])
        sales_col = _detect_col(columns, ["sales", "revenue", "amount", "quantity", "units"])

        if not date_col or not sales_col:
            return alerts

        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df[sales_col] = pd.to_numeric(df[sales_col], errors="coerce").fillna(0)
        df = df.dropna(subset=[date_col])

        now = datetime.now()
        current_month = df[df[date_col].dt.month == now.month]
        last_month = df[df[date_col].dt.month == (now.month - 1 if now.month > 1 else 12)]

        if current_month.empty or last_month.empty:
            return alerts

        current_total = current_month[sales_col].sum()
        last_total = last_month[sales_col].sum()

        # Pro-rate last month to current day of month
        days_in_month = 30
        day_of_month = now.day
        expected_so_far = (last_total / days_in_month) * day_of_month

        if expected_so_far > 0:
            pct_of_target = (current_total / expected_so_far) * 100
            gap_pct = 100 - pct_of_target

            if gap_pct >= 20:
                alerts.append({
                    "alert_type": "REVENUE",
                    "severity": "HIGH",
                    "message": f"📉 Revenue target se {gap_pct:.0f}% peeche hai! Promotions ya discounts try karein.",
                })
            elif gap_pct >= 10:
                alerts.append({
                    "alert_type": "REVENUE",
                    "severity": "MEDIUM",
                    "message": f"📊 Revenue thoda peeche hai ({gap_pct:.0f}%). Sales strategies review karein.",
                })
    except Exception:
        pass

    return alerts


def run_all_checks(db: Session) -> List[Dict]:
    """Run all alert checks and return combined list."""
    all_alerts = []
    all_alerts.extend(check_inventory_alerts(db))
    all_alerts.extend(check_festival_alerts())
    all_alerts.extend(check_revenue_alerts(db))
    return all_alerts


def save_alerts_to_db(db: Session, alerts: List[Dict]):
    """Persist generated alerts to the database."""
    for alert_data in alerts:
        alert = Alert(
            alert_type=alert_data["alert_type"],
            severity=alert_data["severity"],
            message=alert_data["message"],
        )
        db.add(alert)
    try:
        db.commit()
    except Exception:
        db.rollback()
