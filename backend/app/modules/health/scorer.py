import numpy as np
import pandas as pd
from typing import Dict, Optional, Any
from sqlalchemy.orm import Session
from datetime import datetime, date

from app.models.dataset import Dataset
from app.models.sales_data import SalesData
from app.models.product import Product


def _revenue_score(df: pd.DataFrame, date_col: str, sales_col: str) -> Dict[str, Any]:
    """Score out of 30. Compares latest available month vs previous month."""
    max_points = 30
    try:
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df[sales_col] = pd.to_numeric(df[sales_col], errors="coerce").fillna(0)
        df = df.dropna(subset=[date_col])

        if df.empty:
            return {"score": 15, "note": "No valid dated sales records."}

        max_date = df[date_col].max()
        latest_ym = max_date.to_period("M")
        prev_ym = latest_ym - 1

        current = df[df[date_col].dt.to_period("M") == latest_ym][sales_col].sum()
        last = df[df[date_col].dt.to_period("M") == prev_ym][sales_col].sum()

        if last == 0:
            return {"score": 20, "note": "Previous month data nahi mila.", "current_month_revenue": round(float(current), 0)}

        # Pro-rate based on days completed in latest month
        days_done = max(1, min(30, max_date.day))
        expected = (last / 30.0) * days_done
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
            "pct_of_target": round(float(pct), 1),
        }
    except Exception as e:
        return {"score": 15, "note": f"Revenue calculation error: {str(e)[:50]}"}


def _sales_trend_score(df: pd.DataFrame, date_col: str, sales_col: str) -> Dict[str, Any]:
    """Score out of 25. Growing=25, Stable=20, Declining=10."""
    try:
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df[sales_col] = pd.to_numeric(df[sales_col], errors="coerce").fillna(0)
        df["ym"] = df[date_col].dt.to_period("M")
        monthly = df.groupby("ym")[sales_col].sum()

        if len(monthly) < 2:
            return {"score": 20, "trend": "insufficient_data"}

        if len(monthly) >= 4:
            recent = monthly[-2:].mean()
            older = monthly[:-2].mean()
        else:
            recent = monthly.iloc[-1]
            older = monthly.iloc[-2]

        pct_change = ((recent - older) / older) * 100 if older > 0 else 0

        if pct_change > 5:
            return {"score": 25, "trend": "growing", "change_pct": round(float(pct_change), 1)}
        elif pct_change > -5:
            return {"score": 20, "trend": "stable", "change_pct": round(float(pct_change), 1)}
        else:
            return {"score": 10, "trend": "declining", "change_pct": round(float(pct_change), 1)}
    except Exception:
        return {"score": 20, "trend": "unknown"}


def _product_diversity_score(df: pd.DataFrame, sales_col: str, product_col: Optional[str]) -> Dict[str, Any]:
    """Score out of 20. Less dependency on a single product = higher score."""
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
            "top_product_revenue_pct": round(float(top_pct), 1),
            "top_product": str(product_sales.idxmax()),
        }
    except Exception:
        return {"score": 15}


def compute_health_score(db: Session) -> Dict[str, Any]:
    """
    Compute overall Business Health Score (0-100) across 4 components:
    1. Revenue (30 pts)
    2. Inventory Health (25 pts)
    3. Sales Trend (25 pts)
    4. Product Diversity (20 pts)
    Prioritizes live PostgreSQL tables (sales_data, products) with fallback to uploaded datasets.
    """
    # ── 1. Fetch Sales Data (Live PostgreSQL First) ──
    sales_rows = db.query(SalesData).all()
    products = db.query(Product).all()
    prod_map = {p.id: p.name for p in products}

    df = None
    date_col = "date"
    sales_col = "revenue"
    product_col = "product"

    if sales_rows:
        df = pd.DataFrame([{
            "date": s.date,
            "revenue": float(s.revenue or 0),
            "quantity": s.quantity_sold or 0,
            "product": prod_map.get(s.product_id, f"Product #{s.product_id}")
        } for s in sales_rows])
    else:
        # Fallback to uploaded dataset
        latest = db.query(Dataset).order_by(Dataset.id.desc()).first()
        if latest and latest.data and len(latest.data) > 0:
            from app.modules.inventory.router import _detect_col
            raw_df = pd.DataFrame(latest.data)
            cols = list(raw_df.columns)
            d_col = _detect_col(cols, ["date", "order_date", "invoice_date", "month", "time"])
            s_col = _detect_col(cols, ["sales", "revenue", "amount", "quantity", "units"])
            p_col = _detect_col(cols, ["product_name", "product", "item", "sku", "category"])
            if d_col and s_col:
                df = raw_df
                date_col = d_col
                sales_col = s_col
                product_col = p_col

    # ── 2. Handle Genuinely Missing Data ──
    if df is None or df.empty:
        return {
            "total_score": None,
            "grade": "N/A",
            "status": "no_data",
            "message": "Sales data available nahi hai. POS billing start karein ya sales data upload karein.",
            "components": {
                "revenue": 0,
                "inventory": 0,
                "sales_trend": 0,
                "product_diversity": 0
            },
            "top_issue": "Sales data available nahi hai — pehle sales record ya upload karein."
        }

    # ── 3. Component Scores ──
    rev = _revenue_score(df.copy(), date_col, sales_col)
    trend = _sales_trend_score(df.copy(), date_col, sales_col)
    diversity = _product_diversity_score(df.copy(), sales_col, product_col)

    # ── 4. Inventory Score (out of 25) ──
    if products:
        optimal_count = 0
        overstock_count = 0
        low_count = 0
        critical_count = 0
        total_prods = len(products)
        product_points = 0.0

        for p in products:
            stk = p.current_stock
            rp = p.reorder_point
            if stk <= max(1, rp // 3):
                critical_count += 1
                product_points += 0.20  # Critical penalty
            elif stk <= rp:
                low_count += 1
                product_points += 0.60  # Low stock
            elif stk >= rp * 6:
                overstock_count += 1
                product_points += 0.85  # Overstock minor penalty
            else:
                optimal_count += 1
                product_points += 1.00  # Optimal healthy stock

        ratio = product_points / total_prods
        inv_score = max(5, min(25, round(ratio * 25)))
    else:
        inv_score = 20
        critical_count = 0
        low_count = 0

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

    # Top issue diagnosis
    scores = {
        "Revenue": (rev["score"], 30),
        "Inventory": (inv_score, 25),
        "Sales Trend": (trend["score"], 25),
        "Product Diversity": (diversity["score"], 20),
    }
    # Rank by percentage of max score achieved
    lowest_key = min(scores, key=lambda k: scores[k][0] / scores[k][1])
    achieved, max_pts = scores[lowest_key]

    if lowest_key == "Inventory" and (critical_count > 0 or low_count > 0):
        top_issue = f"Low stock detected ({low_count + critical_count} items need reorder)."
    elif lowest_key == "Revenue":
        top_issue = f"Monthly revenue pace is below historical average."
    elif lowest_key == "Product Diversity":
        top_issue = f"Revenue is concentrated in few products ({diversity.get('top_product', 'top item')})."
    else:
        top_issue = f"{lowest_key} score ({achieved}/{max_pts}) is the primary area for improvement."

    message = (
        f"Aapka business {total}/100 par hai — Grade {grade} ({trend_text}). {top_issue}"
    )

    return {
        "total_score": total,
        "grade": grade,
        "status": "ready",
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
