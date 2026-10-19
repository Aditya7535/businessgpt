from typing import List, Dict, Any
from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.alert import Alert
from app.models.dataset import Dataset
from app.models.product import Product
from app.models.sales_data import SalesData


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


def check_inventory_alerts(db: Session) -> List[Dict[str, Any]]:
    """
    Check live PostgreSQL products inventory for critical/low stock alerts.
    Falls back to uploaded dataset if no products are configured in PostgreSQL.
    """
    alerts = []
    products = db.query(Product).all()

    if products:
        for p in products:
            if p.current_stock <= 0:
                alerts.append({
                    "alert_type": "INVENTORY",
                    "severity": "HIGH",
                    "message": f"Stock Alert: {p.name} has reached 0 {p.unit or 'pcs'} (Reorder point: {p.reorder_point}).",
                })
            elif p.current_stock <= max(1, p.reorder_point // 3):
                alerts.append({
                    "alert_type": "INVENTORY",
                    "severity": "HIGH",
                    "message": f"Critical Stock Alert: {p.name} is down to {p.current_stock} {p.unit or 'pcs'} (Reorder point: {p.reorder_point}).",
                })
            elif p.current_stock <= p.reorder_point:
                alerts.append({
                    "alert_type": "INVENTORY",
                    "severity": "MEDIUM",
                    "message": f"Low Stock Alert: {p.name} has reached {p.current_stock} {p.unit or 'pcs'} (Reorder point: {p.reorder_point}).",
                })
        return alerts

    # Fallback to dataset if live products table is empty
    latest = db.query(Dataset).order_by(Dataset.id.desc()).first()
    if not latest or not latest.data:
        return alerts

    try:
        from app.modules.inventory.engine import analyze_all_products
        from app.modules.inventory.router import _detect_col

        columns = list(latest.data[0].keys())
        date_col = _detect_col(columns, ["date", "order_date", "invoice_date", "month", "time"])
        sales_col = _detect_col(columns, ["quantity", "units", "qty", "sales", "revenue", "amount"])
        product_col = _detect_col(columns, ["product_name", "product", "item", "sku", "category"])

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


def reconcile_resolved_inventory_alerts(db: Session) -> int:
    """
    Reconciles live PostgreSQL product stock with pending unread alerts:
    1. If product stock > reorder_point, marks any old unread low-stock alerts for that product as read.
    2. If product stock <= reorder_point, ensures an active alert exists.
    """
    products = db.query(Product).all()
    resolved_count = 0

    for p in products:
        if p.current_stock > p.reorder_point:
            stale_alerts = (
                db.query(Alert)
                .filter(
                    Alert.is_read == False,
                    Alert.alert_type == "INVENTORY",
                    Alert.message.ilike(f"%{p.name}%")
                )
                .all()
            )
            for a in stale_alerts:
                a.is_read = True
                resolved_count += 1
    # 2. Ensure every currently low product has an active alert
    valid_low_names = [p.name for p in products if p.current_stock <= p.reorder_point]
    for p in products:
        if p.current_stock <= p.reorder_point:
            existing = (
                db.query(Alert)
                .filter(
                    Alert.is_read == False,
                    Alert.alert_type == "INVENTORY",
                    Alert.message.ilike(f"%{p.name}%")
                )
                .first()
            )
            if not existing:
                msg = (
                    f"Stock Alert: {p.name} has reached 0 {p.unit or 'pack'} (Reorder point: {p.reorder_point})."
                    if p.current_stock <= 0
                    else f"Stock Alert: {p.name} has reached {p.current_stock} {p.unit or 'pack'} (Reorder point: {p.reorder_point})."
                )
                new_a = Alert(
                    alert_type="INVENTORY",
                    severity="HIGH" if p.current_stock <= max(1, p.reorder_point // 3) else "MEDIUM",
                    message=msg
                )
                db.add(new_a)

    # 3. Mark read any unread INVENTORY alerts for products that are not currently low on stock
    all_unread_inv = db.query(Alert).filter(Alert.is_read == False, Alert.alert_type == "INVENTORY").all()
    for a in all_unread_inv:
        if not any(low_name.lower() in a.message.lower() for low_name in valid_low_names):
            a.is_read = True
            resolved_count += 1

    try:
        db.commit()
    except Exception:
        db.rollback()

    return resolved_count


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
    """Check if current month revenue is on track using live sales_data or uploaded datasets."""
    alerts = []
    import pandas as pd

    sales_rows = db.query(SalesData).all()
    if sales_rows:
        df = pd.DataFrame([{
            "date": s.date,
            "sales": float(s.revenue or 0)
        } for s in sales_rows])
        date_col = "date"
        sales_col = "sales"
    else:
        latest = db.query(Dataset).order_by(Dataset.id.desc()).first()
        if not latest or not latest.data:
            return alerts
        from app.modules.inventory.router import _detect_col
        df = pd.DataFrame(latest.data)
        columns = list(df.columns)
        date_col = _detect_col(columns, ["date", "order_date", "invoice_date", "month", "time"])
        sales_col = _detect_col(columns, ["sales", "revenue", "amount", "quantity", "units"])
        if not date_col or not sales_col:
            return alerts

    try:
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df[sales_col] = pd.to_numeric(df[sales_col], errors="coerce").fillna(0)
        df = df.dropna(subset=[date_col])

        if df.empty:
            return alerts

        max_date = df[date_col].max()
        latest_ym = max_date.to_period("M")
        prev_ym = latest_ym - 1

        current_total = df[df[date_col].dt.to_period("M") == latest_ym][sales_col].sum()
        last_total = df[df[date_col].dt.to_period("M") == prev_ym][sales_col].sum()

        if last_total <= 0:
            return alerts

        day_of_month = max(1, min(30, max_date.day))
        expected_so_far = (last_total / 30.0) * day_of_month

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
    """Persist generated alerts to the database without inserting exact duplicates."""
    for alert_data in alerts:
        existing = (
            db.query(Alert)
            .filter(
                Alert.is_read == False,
                Alert.message == alert_data["message"]
            )
            .first()
        )
        if not existing:
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
