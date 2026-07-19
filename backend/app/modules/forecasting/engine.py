import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from datetime import date

from app.modules.forecasting.features import (
    prepare_dataframe, get_festival_impact_for_period
)
from app.modules.forecasting.models.rf_model import run_random_forest


def _get_horizon_days(horizon: str) -> int:
    mapping = {"week": 7, "month": 30, "quarter": 90}
    return mapping.get(horizon.lower(), 30)


def _ensemble_predictions(results: List[Dict], weights: List[float]) -> List[Dict]:
    """Weighted average ensemble of prediction lists."""
    n_days = len(results[0]["predictions"])
    ensembled = []
    for i in range(n_days):
        weighted_pred = sum(r["predictions"][i]["predicted"] * w for r, w in zip(results, weights))
        weighted_lower = sum(r["predictions"][i]["lower"] * w for r, w in zip(results, weights))
        weighted_upper = sum(r["predictions"][i]["upper"] * w for r, w in zip(results, weights))
        ensembled.append({
            "date": results[0]["predictions"][i]["date"],
            "predicted": round(weighted_pred, 2),
            "lower": round(weighted_lower, 2),
            "upper": round(weighted_upper, 2),
        })
    return ensembled


def _weighted_mape(results: List[Dict], weights: List[float]) -> float:
    return round(sum(r["mape"] * w for r, w in zip(results, weights)), 2)


def run_forecast(
    raw_data: list[dict],
    date_col: str,
    sales_col: str,
    horizon: str = "month",
    product_filter: Optional[str] = None,
    product_col: Optional[str] = None,
    include_festivals: bool = True,
) -> Dict:
    """
    Main forecasting entry point. Auto-selects model based on data size.
    Returns the full response dict as specified.
    """
    # ── Prepare data ──
    df = prepare_dataframe(raw_data, date_col, sales_col, product_filter, product_col)
    horizon_days = _get_horizon_days(horizon)
    n_rows = len(df)

    results = []
    weights = []
    model_name = "random_forest"

    # ── Auto-select model strategy ──
    if n_rows < 30:
        # Only Random Forest
        rf_result = run_random_forest(df, horizon_days)
        results = [rf_result]
        weights = [1.0]
        model_name = "random_forest"

    elif n_rows < 100:
        # Prophet + Random Forest
        try:
            from app.modules.forecasting.models.prophet_model import run_prophet
            prophet_result = run_prophet(df, horizon_days)
            rf_result = run_random_forest(df, horizon_days)
            results = [prophet_result, rf_result]
            weights = [0.6, 0.4]
            model_name = "prophet+rf_ensemble"
        except Exception:
            rf_result = run_random_forest(df, horizon_days)
            results = [rf_result]
            weights = [1.0]
            model_name = "random_forest"

    else:
        # Full ensemble: Prophet + XGBoost + RF
        try:
            from app.modules.forecasting.models.prophet_model import run_prophet
            from app.modules.forecasting.models.xgboost_model import run_xgboost
            prophet_result = run_prophet(df, horizon_days)
            xgb_result = run_xgboost(df, horizon_days)
            rf_result = run_random_forest(df, horizon_days)
            results = [prophet_result, xgb_result, rf_result]
            weights = [0.5, 0.3, 0.2]
            model_name = "full_ensemble"
        except Exception as e:
            rf_result = run_random_forest(df, horizon_days)
            results = [rf_result]
            weights = [1.0]
            model_name = "random_forest"

    # ── Build ensemble predictions ──
    final_predictions = _ensemble_predictions(results, weights) if len(results) > 1 else results[0]["predictions"]
    final_mape = _weighted_mape(results, weights)
    final_rmse = round(float(np.sqrt(np.mean([
        (p["predicted"] - p["lower"]) ** 2 for p in final_predictions
    ]))), 2)

    # ── Festival impact in forecast period ──
    start_date = date.fromisoformat(final_predictions[0]["date"])
    end_date = date.fromisoformat(final_predictions[-1]["date"])
    festival_impact = get_festival_impact_for_period(start_date, end_date) if include_festivals else {}

    # ── Historical chart data ──
    historical = [
        {"date": row["ds"].strftime("%Y-%m-%d"), "actual": row["y"]}
        for _, row in df[["ds", "y"]].iterrows()
    ]

    # ── Average prediction for insights ──
    avg_pred = round(float(np.mean([p["predicted"] for p in final_predictions])), 2)
    last_actuals = df["y"].tail(30).mean()
    pct_change = round(((avg_pred - last_actuals) / last_actuals) * 100, 1) if last_actuals > 0 else 0
    direction = "zyada" if pct_change >= 0 else "kam"
    festival_str = (
        ", ".join([f"{k} ({v})" for k, v in festival_impact.items()])
        if festival_impact
        else "koi major festival nahi"
    )
    insights = (
        f"Agle {horizon} mein avg sales {avg_pred:,.0f} units expected hai, "
        f"jo recent period se {abs(pct_change)}% {direction} hai. "
        f"Is period mein: {festival_str}."
    )

    # ── Inventory suggestion ──
    inventory_suggestion = (
        f"Aapko approx ₹{avg_pred * horizon_days:,.0f} worth of stock "
        f"(ya {int(avg_pred * horizon_days)} units) order karne chahiye "
        f"agle {horizon} ke liye, considering predicted demand."
    )

    return {
        "forecast": final_predictions,
        "model_used": model_name,
        "accuracy": {"mape": final_mape, "rmse": final_rmse},
        "insights": insights,
        "festival_impact": festival_impact,
        "inventory_suggestion": inventory_suggestion,
        "chart_data": {
            "historical": historical,
            "forecast": final_predictions,
        },
    }
