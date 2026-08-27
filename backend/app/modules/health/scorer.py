import numpy as np
import pandas as pd
from typing import Dict, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.dataset import Dataset


def _revenue_score(df: pd.DataFrame, date_col: str, sales_col: str) -> Dict:
    """Score out of 30. Compares current month vs last month."""
    max_points = 30
    try:
        now = datetime.now()
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df[sales_col] = pd.to_numeric(df[sales_col], errors="coerce").fillna(0)

        current = df[df[date_col].dt.month == now.month][sales_col].sum()
        last = df[df[date_col].dt.month == (now.month - 1 if now.month > 1 else 12)][sales_col].sum()

        if last == 0:
            return {"score": 20, "note": "Previous month data nahi mila."}

        days_done = now.day
        expected = (last / 30) * days_done
        pct = (current / expected) * 100 if expected > 0 else 100

        if pct >= 100:
            score = max_points
        elif pct >= 90:
            score = 24
        elif pct >= 80:
            score = 18
        else:
            score = 12

        return {
            "score": score,
            "current_month_revenue": round(float(current), 0),
            "last_month_revenue": round(float(last), 0),
            "pct_of_target": round(pct, 1),
        }
    except Exception as e:
        return {"score": 15, "note": f"Revenue calculation error: {str(e)[:50]}"}


def _sales_trend_score(df: pd.DataFrame, date_col: str, sales_col: str) -> Dict:
    """Score out of 25. Growing=25, Stable=20, Declining=10."""
    try:
        df["ym"] = df[date_col].dt.to_period("M")
        monthly = df.groupby("ym")[sales_col].sum().tail(6)

        if len(monthly) < 3:
            return {"score": 20, "trend": "insufficient_data"}

        recent = monthly[-3:].mean()
        older = monthly[:-3].mean()

        pct_change = ((recent - older) / older) * 100 if older > 0 else 0

        if pct_change > 5:
            return {"score": 25, "trend": "growing", "change_pct": round(pct_change, 1)}
        elif pct_change > -5:
            return {"score": 20, "trend": "stable", "change_pct": round(pct_change, 1)}
        else:
            return {"score": 10, "trend": "declining", "change_pct": round(pct_change, 1)}
    except Exception:
        return {"score": 20, "trend": "unknown"}


def _product_diversity_score(df: pd.DataFrame, sales_col: str, product_col: Optional[str]) -> Dict:
    """Score out of 20. Less dependency on one product = higher score."""
    if not product_col or product_col not in df.columns:
        return {"score": 15, "note": "Product column not found."}

    try:
        product_sales = df.groupby(product_col)[sales_col].sum()
        total = product_sales.sum()
        if total == 0:
            return {"score": 15}

        top_pct = (product_sales.max() / total) * 100

        if top_pct < 40:
            score = 20
        elif top_pct < 60:
            score = 15
        elif top_pct < 70:
            score = 12
        else:
            score = 10

        return {
            "score": score,
            "top_product_revenue_pct": round(top_pct, 1),
            "top_product": str(product_sales.idxmax()),
        }
    except Exception:
        return {"score": 15}


def compute_health_score(db: Session) -> Dict:
    """
    Compute overall Business Health Score (0-100) across 4 components.
    """
    latest = db.query(Dataset).order_by(Dataset.id.desc()).first()
    if not latest or not latest.data:
        return {
            "total_score": 0,
            "grade": "N/A",
            "message": "Koi data nahi mila. Pehle file upload karein.",
            "components": {},
        }

    df = pd.DataFrame(latest.data)
    columns = list(df.columns)

    from app.modules.inventory.router import _detect_col
    date_col = _detect_col(columns, ["date", "order_date", "invoice_date", "month", "time"])
    sales_col = _detect_col(columns, ["sales", "revenue", "amount", "quantity", "units"])
    product_col = _detect_col(columns, ["product", "item", "sku", "category", "product_name"])

    if not date_col or not sales_col:
        return {
            "total_score": 0,
            "grade": "N/A",
            "message": "Date ya sales column detect nahi hua.",
            "components": {},
        }

    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df[sales_col] = pd.to_numeric(df[sales_col], errors="coerce").fillna(0)
    df = df.dropna(subset=[date_col])

    # ── Component scores ──
    rev = _revenue_score(df.copy(), date_col, sales_col)
    trend = _sales_trend_score(df.copy(), date_col, sales_col)
    diversity = _product_diversity_score(df.copy(), sales_col, product_col)

    # Inventory score from Phase 4
    inv_score = 25  # default
    try:
        from app.modules.inventory.engine import analyze_all_products
        results = analyze_all_products(
            data=latest.data, date_col=date_col,
            sales_col=sales_col, product_col=product_col or ""
        )
        from app.modules.inventory.health_score import compute_inventory_health_score
        inv_health = compute_inventory_health_score(results)
        # Re-scale from 100 to 25
        inv_score = round((inv_health["score"] / 100) * 25)
    except Exception:
        pass

    total = rev["score"] + inv_score + trend["score"] + diversity["score"]

    # Grade
    if total >= 90:
        grade, trend_text = "A", "excellent"
    elif total >= 75:
        grade, trend_text = "B", "good"
    elif total >= 60:
        grade, trend_text = "C", "average"
    elif total >= 40:
        grade, trend_text = "D", "needs improvement"
    else:
        grade, trend_text = "F", "critical"

    # Top issue
    scores = {
        "Revenue": rev["score"],
        "Inventory": inv_score,
        "Sales Trend": trend["score"],
        "Product Diversity": diversity["score"],
    }
    top_issue_key = min(scores, key=scores.get)
    top_issue = f"{top_issue_key} score sabse kam hai — ise improve karein."

    message = (
        f"Aapka business {total}/100 par hai — Grade {grade} ({trend_text}). "
        f"{top_issue}"
    )

    return {
        "total_score": total,
        "grade": grade,
        "components": {
            "revenue": rev["score"],
            "inventory": inv_score,
            "sales_trend": trend["score"],
            "product_diversity": diversity["score"],
        },
        "component_details": {
            "revenue": rev,
            "sales_trend": trend,
            "product_diversity": diversity,
        },
        "trend": trend_text,
        "message": message,
        "top_issue": top_issue,
    }
