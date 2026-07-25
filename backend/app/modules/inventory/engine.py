import numpy as np
import pandas as pd
from typing import Dict, List, Optional
from scipy import stats

from app.modules.inventory.classifier import classify_product

# ── Default business assumptions ──
DEFAULT_LEAD_TIME_DAYS = 7
DEFAULT_ORDER_COST_INR = 500.0
DEFAULT_HOLDING_COST_PCT = 0.20   # 20% of product value per year
DEFAULT_SERVICE_LEVEL_Z = 1.65    # 95% service level
DAYS_IN_YEAR = 365

# ── Status thresholds ──
CRITICAL_DAYS = 7
LOW_DAYS = 14
OVERSTOCK_DAYS = 90


def _compute_eoq(
    annual_demand: float,
    order_cost: float,
    unit_price: float,
    holding_cost_pct: float = DEFAULT_HOLDING_COST_PCT
) -> float:
    """Economic Order Quantity formula."""
    holding_cost = unit_price * holding_cost_pct
    if holding_cost <= 0 or annual_demand <= 0:
        return 0.0
    return float(np.sqrt((2 * annual_demand * order_cost) / holding_cost))


def _compute_safety_stock(
    std_daily_demand: float,
    lead_time_days: float = DEFAULT_LEAD_TIME_DAYS,
    z_score: float = DEFAULT_SERVICE_LEVEL_Z
) -> float:
    """Safety Stock = Z × σ(demand) × √(Lead Time)"""
    return z_score * std_daily_demand * np.sqrt(lead_time_days)


def _compute_reorder_point(
    avg_daily_demand: float,
    lead_time_days: float = DEFAULT_LEAD_TIME_DAYS,
    safety_stock: float = 0.0
) -> float:
    """Reorder Point = (Avg Daily Demand × Lead Time) + Safety Stock"""
    return (avg_daily_demand * lead_time_days) + safety_stock


def _get_status(days_remaining: float, reorder_point: float, current_stock: float) -> str:
    if days_remaining <= CRITICAL_DAYS:
        return "CRITICAL"
    elif days_remaining <= LOW_DAYS or current_stock <= reorder_point:
        return "LOW_STOCK"
    elif days_remaining > OVERSTOCK_DAYS:
        return "OVERSTOCK"
    else:
        return "OPTIMAL"


def _generate_insight(
    product: str,
    status: str,
    days_remaining: float,
    recommended_qty: float,
    demand_class: str,
    forecast_used: bool
) -> str:
    forecast_note = "forecast ke hisaab se" if forecast_used else "historical data ke hisaab se"
    days_str = f"{int(days_remaining)} din" if days_remaining < 999 else "kaafi lambe time"

    if status == "CRITICAL":
        return (
            f"⚠️ URGENT: {product} ka stock sirf {days_str} mein khatam hoga! "
            f"Turant {int(recommended_qty)} units order karein."
        )
    elif status == "LOW_STOCK":
        return (
            f"{product} ka stock {days_str} mein khatam hoga. "
            f"{forecast_note} aapko {int(recommended_qty)} units order karne chahiye."
        )
    elif status == "OVERSTOCK":
        return (
            f"{product} mein {days_str} ka stock hai — yeh overstock hai. "
            f"Nayi order rokein aur existing stock sell karein."
        )
    else:
        return (
            f"{product} ka stock optimal level par hai ({days_str} remaining). "
            f"Demand classification: {demand_class}."
        )


def analyze_product(
    product_name: str,
    current_stock: float,
    sales_history: List[float],          # daily or monthly sales list
    unit_price: float = 100.0,
    lead_time_days: float = DEFAULT_LEAD_TIME_DAYS,
    order_cost: float = DEFAULT_ORDER_COST_INR,
    forecast_demand: Optional[float] = None,  # avg daily demand from Phase 3
) -> Dict:
    """
    Core inventory analysis for a single product.
    Returns the full inventory analysis dict.
    """
    if not sales_history:
        return {
            "product": product_name,
            "error": "Sales history nahi mili. Pehle data upload karein."
        }

    sales_arr = np.array(sales_history, dtype=float)

    # Determine if input is daily or monthly (heuristic: if avg > 100, assume monthly)
    avg_raw = float(np.mean(sales_arr))
    if avg_raw > 200:
        # Monthly data — convert to daily
        avg_daily = avg_raw / 30
        std_daily = float(np.std(sales_arr)) / 30
        monthly_sales = sales_history
    else:
        avg_daily = avg_raw
        std_daily = float(np.std(sales_arr))
        monthly_sales = [s * 30 for s in sales_arr]

    # Use forecast if available (overrides historical average)
    effective_daily_demand = forecast_demand if forecast_demand else avg_daily
    forecast_used = forecast_demand is not None

    # ── Calculations ──
    safety_stock = _compute_safety_stock(std_daily, lead_time_days)
    reorder_point = _compute_reorder_point(effective_daily_demand, lead_time_days, safety_stock)

    annual_demand = effective_daily_demand * DAYS_IN_YEAR
    eoq = _compute_eoq(annual_demand, order_cost, unit_price)

    days_remaining = (current_stock / effective_daily_demand) if effective_daily_demand > 0 else 999

    # Recommended order = 1 EOQ cycle or enough to cover lead time + safety
    recommended_order_qty = max(eoq, reorder_point - current_stock + eoq)
    recommended_order_qty = max(0, recommended_order_qty)

    status = _get_status(days_remaining, reorder_point, current_stock)

    # Demand classification
    demand_result = classify_product(monthly_sales, product_name)
    demand_class = demand_result["classification"]

    insight = _generate_insight(
        product_name, status, days_remaining,
        recommended_order_qty, demand_class, forecast_used
    )

    return {
        "product": product_name,
        "current_stock": round(current_stock, 0),
        "days_remaining": round(days_remaining, 1),
        "reorder_point": round(reorder_point, 1),
        "recommended_order_qty": round(recommended_order_qty, 0),
        "status": status,
        "safety_stock": round(safety_stock, 1),
        "eoq": round(eoq, 1),
        "avg_daily_demand": round(effective_daily_demand, 2),
        "demand_classification": demand_class,
        "forecast_used": forecast_used,
        "insight": insight,
        "unit_price_inr": unit_price,
        "lead_time_days": lead_time_days,
    }


def analyze_all_products(
    data: List[Dict],
    date_col: str,
    sales_col: str,
    product_col: str,
    stock_col: Optional[str] = None,
    price_col: Optional[str] = None,
    product_filter: Optional[str] = None,
) -> List[Dict]:
    """
    Runs analyze_product for every product in the dataset.
    """
    df = pd.DataFrame(data)

    if product_col not in df.columns or sales_col not in df.columns:
        return [{"error": f"Required columns missing. Available: {list(df.columns)}"}]

    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df[sales_col] = pd.to_numeric(df[sales_col], errors="coerce").fillna(0)
    df = df.dropna(subset=[date_col])
    df["year_month"] = df[date_col].dt.to_period("M")

    results = []
    products = [product_filter] if product_filter else df[product_col].unique().tolist()

    for product in products:
        product_df = df[df[product_col].astype(str).str.lower() == str(product).lower()]
        if product_df.empty:
            results.append({"product": product, "error": "Product data nahi mila."})
            continue

        monthly = product_df.groupby("year_month")[sales_col].sum().tolist()

        # Current stock
        current_stock = 100.0  # default if no stock column
        if stock_col and stock_col in product_df.columns:
            stock_vals = pd.to_numeric(product_df[stock_col], errors="coerce").dropna()
            current_stock = float(stock_vals.iloc[-1]) if len(stock_vals) > 0 else 100.0

        # Unit price
        unit_price = 100.0
        if price_col and price_col in product_df.columns:
            price_vals = pd.to_numeric(product_df[price_col], errors="coerce").dropna()
            unit_price = float(price_vals.mean()) if len(price_vals) > 0 else 100.0

        result = analyze_product(
            product_name=str(product),
            current_stock=current_stock,
            sales_history=monthly,
            unit_price=unit_price,
        )
        results.append(result)

    return results
