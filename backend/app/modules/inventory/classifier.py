import numpy as np
import pandas as pd
from typing import Dict, List, Optional

# Thresholds for demand classification
FAST_MOVING_THRESHOLD = 50   # units/month
SLOW_MOVING_THRESHOLD = 10   # units/month
SEASONAL_CV_THRESHOLD = 0.5  # coefficient of variation threshold


def classify_product(
    monthly_sales: List[float],
    product_name: str = "Product"
) -> Dict:
    """
    Classifies a product's demand pattern based on its monthly sales history.

    Categories:
    - FAST_MOVING  : avg > 50 units/month
    - SLOW_MOVING  : avg < 10 units/month
    - SEASONAL     : high month-to-month variance (CV > 0.5)
    - INTERMITTENT : irregular pattern (many zero-sales months)
    - NORMAL       : everything else
    """
    if not monthly_sales or len(monthly_sales) == 0:
        return {
            "product": product_name,
            "classification": "UNKNOWN",
            "avg_monthly_demand": 0.0,
            "avg_daily_demand": 0.0,
            "std_monthly_demand": 0.0,
            "cv": 0.0,
            "zero_months_pct": 0.0,
            "description": "Insufficient data for classification."
        }

    sales_arr = np.array(monthly_sales, dtype=float)
    avg = float(np.mean(sales_arr))
    std = float(np.std(sales_arr))
    cv = std / avg if avg > 0 else 0.0  # Coefficient of Variation

    zero_months = int(np.sum(sales_arr == 0))
    zero_months_pct = zero_months / len(sales_arr)

    # Classification logic
    if zero_months_pct >= 0.4:
        classification = "INTERMITTENT"
        description = f"{int(zero_months_pct * 100)}% mahine mein koi sale nahi — irregular demand pattern."
    elif avg >= FAST_MOVING_THRESHOLD:
        classification = "FAST_MOVING"
        description = f"High demand product — avg {avg:.0f} units/month. Reorder frequently."
    elif avg < SLOW_MOVING_THRESHOLD:
        classification = "SLOW_MOVING"
        description = f"Low demand product — avg {avg:.0f} units/month. Review stocking strategy."
    elif cv > SEASONAL_CV_THRESHOLD:
        classification = "SEASONAL"
        description = f"High variance demand (CV={cv:.2f}) — likely seasonal. Plan accordingly."
    else:
        classification = "NORMAL"
        description = f"Stable demand — avg {avg:.0f} units/month with moderate variance."

    return {
        "product": product_name,
        "classification": classification,
        "avg_monthly_demand": round(avg, 2),
        "avg_daily_demand": round(avg / 30, 2),
        "std_monthly_demand": round(std, 2),
        "cv": round(cv, 3),
        "zero_months_pct": round(zero_months_pct, 2),
        "description": description
    }


def classify_all_products(
    data: List[Dict],
    date_col: str,
    sales_col: str,
    product_col: str
) -> Dict[str, Dict]:
    """
    Given raw PostgreSQL data, classifies every product found.
    Returns {product_name: classification_dict}
    """
    df = pd.DataFrame(data)

    if product_col not in df.columns or sales_col not in df.columns or date_col not in df.columns:
        return {}

    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df[sales_col] = pd.to_numeric(df[sales_col], errors="coerce").fillna(0)
    df = df.dropna(subset=[date_col])

    # Group by product and month to get monthly demand
    df["year_month"] = df[date_col].dt.to_period("M")

    results = {}
    for product, group in df.groupby(product_col):
        monthly = group.groupby("year_month")[sales_col].sum()
        results[str(product)] = classify_product(
            monthly_sales=monthly.tolist(),
            product_name=str(product)
        )

    return results
