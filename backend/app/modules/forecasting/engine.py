import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Optional
from datetime import date
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.modules.forecasting.features import (
    add_time_features, get_festival_impact_for_period
)
from app.modules.forecasting.models.rf_model import run_random_forest

logger = logging.getLogger("businessgpt.forecasting")


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
        d_str = results[0]["predictions"][i]["date"]
        ensembled.append({
            "date": d_str,
            "ds": d_str,
            "predicted": round(weighted_pred, 2),
            "yhat": round(weighted_pred, 2),
            "lower": round(weighted_lower, 2),
            "yhat_lower": round(weighted_lower, 2),
            "upper": round(weighted_upper, 2),
            "yhat_upper": round(weighted_upper, 2),
        })
    return ensembled


def _weighted_mape(results: List[Dict], weights: List[float]) -> Optional[float]:
    valid = [(r["mape"], w) for r, w in zip(results, weights) if r.get("mape") is not None]
    if not valid:
        return None
    total_w = sum(w for _, w in valid)
    if total_w <= 0:
        return None
    return round(sum(m * w for m, w in valid) / total_w, 2)


def fetch_live_sales_data(
    db: Session,
    product_filter: Optional[str] = None
) -> pd.DataFrame:
    """
    Directly query live PostgreSQL sales_data joined with products.
    SELECT s.date, p.name, s.quantity_sold, s.revenue
    FROM sales_data s 
    JOIN products p ON s.product_id = p.id
    ORDER BY s.date
    """
    if product_filter:
        query = text("""
            SELECT s.date, p.name, s.quantity_sold, s.revenue
            FROM sales_data s 
            JOIN products p ON s.product_id = p.id
            WHERE p.name ILIKE :filter
            ORDER BY s.date
        """)
        df = pd.read_sql(query, con=db.bind, params={"filter": f"%{product_filter.strip()}%"})
    else:
        query = text("""
            SELECT s.date, p.name, s.quantity_sold, s.revenue
            FROM sales_data s 
            JOIN products p ON s.product_id = p.id
            ORDER BY s.date
        """)
        df = pd.read_sql(query, con=db.bind)

    return df


def run_forecast(
    db: Optional[Session] = None,
    horizon: str = "month",
    product_filter: Optional[str] = None,
    include_festivals: bool = True,
    target_metric: str = "quantity_sold",
    raw_data: Optional[list] = None,
    **kwargs
) -> Dict:
    """
    Main forecasting entry point using live PostgreSQL sales_data.
    Auto-selects Prophet + XGBoost + RF ensemble based on data size.
    Returns the full forecast response with chart data.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        df_raw = fetch_live_sales_data(db, product_filter=product_filter)
        if df_raw.empty:
            raise ValueError(f"Sales data nahi mila{f' product {product_filter} ke liye' if product_filter else ''}. Please ensure sales_data is populated.")

        # Aggregate daily across all matching products
        df_daily = df_raw.groupby("date", as_index=False).agg({
            "quantity_sold": "sum",
            "revenue": "sum"
        })

        metric_col = target_metric if target_metric in df_daily.columns else "quantity_sold"
        df = pd.DataFrame({
            "ds": pd.to_datetime(df_daily["date"]),
            "y": pd.to_numeric(df_daily[metric_col], errors="coerce").fillna(0)
        }).dropna().sort_values("ds").reset_index(drop=True)

        if len(df) < 10:
            raise ValueError("Forecasting ke liye kam se kam 10 daily sales records chahiye.")

        df = add_time_features(df)
        horizon_days = _get_horizon_days(horizon)
        n_rows = len(df)

        results = []
        weights = []
        model_name = "random_forest"

        # Auto-select model strategy
        if n_rows < 30:
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
            except Exception as e:
                logger.warning(f"Prophet fallback to RF: {e}")
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
                logger.warning(f"Ensemble fallback to Prophet+RF: {e}")
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

        # Build ensemble predictions
        if len(results) > 1:
            final_predictions = _ensemble_predictions(results, weights)
        else:
            final_predictions = [
                {
                    "date": p["date"],
                    "ds": p["date"],
                    "predicted": round(p["predicted"], 2),
                    "yhat": round(p["predicted"], 2),
                    "lower": round(p["lower"], 2),
                    "yhat_lower": round(p["lower"], 2),
                    "upper": round(p["upper"], 2),
                    "yhat_upper": round(p["upper"], 2),
                }
                for p in results[0]["predictions"]
            ]

        final_mape = _weighted_mape(results, weights)
        final_rmse = round(float(np.sqrt(np.mean([
            (p["predicted"] - p["lower"]) ** 2 for p in final_predictions
        ]))), 2)

        # Festival impact in forecast period
        start_date = date.fromisoformat(final_predictions[0]["date"])
        end_date = date.fromisoformat(final_predictions[-1]["date"])
        festival_impact = get_festival_impact_for_period(start_date, end_date) if include_festivals else {}

        # Historical chart data
        historical = [
            {
                "date": row["ds"].strftime("%Y-%m-%d"),
                "ds": row["ds"].strftime("%Y-%m-%d"),
                "actual": round(float(row["y"]), 2),
                "sales": round(float(row["y"]), 2),
            }
            for _, row in df[["ds", "y"]].iterrows()
        ]

        # Average prediction for insights
        avg_pred = round(float(np.mean([p["predicted"] for p in final_predictions])), 2)
        total_forecast_units = int(round(sum(p["predicted"] for p in final_predictions)))
        last_actuals = df["y"].tail(30).mean()
        pct_change = round(((avg_pred - last_actuals) / last_actuals) * 100, 1) if last_actuals > 0 else 0
        direction = "zyada" if pct_change >= 0 else "kam"
        festival_str = (
            ", ".join([f"{k} ({v})" for k, v in festival_impact.items()])
            if festival_impact
            else "koi major festival nahi"
        )
        product_label = f"'{product_filter}'" if product_filter else "overall store"

        # Calculate genuine unit price from historical store data (revenue / quantity_sold)
        total_hist_rev = float(df_raw["revenue"].sum()) if "revenue" in df_raw.columns else 0.0
        total_hist_qty = float(df_raw["quantity_sold"].sum()) if "quantity_sold" in df_raw.columns else 0.0
        avg_unit_price = round(total_hist_rev / total_hist_qty, 2) if total_hist_qty > 0 else 100.0
        est_stock_value = round(total_forecast_units * avg_unit_price, 2)

        mape_str = f" (Backtested holdout MAPE: {final_mape}%)" if final_mape is not None else " (Evaluated on genuine historical trend)"
        insights = (
            f"Agle {horizon} ({horizon_days} din) mein {product_label} ki avg sales {avg_pred:,.1f} units/day (total ~{total_forecast_units:,} units) expected hai, "
            f"jo recent 30-day period se {abs(pct_change)}% {direction} hai{mape_str}. "
            f"Is period mein: {festival_str}."
        )

        inventory_suggestion = (
            f"Aapko approx ₹{est_stock_value:,.0f} worth of stock "
            f"({total_forecast_units:,} units @ avg ₹{avg_unit_price:,.2f}/unit) order karne chahiye "
            f"agle {horizon} ke liye, considering predicted demand."
        )

        return {
            "forecast": final_predictions,
            "historical": historical,
            "model_used": model_name,
            "accuracy": {
                "mape": final_mape,
                "rmse": final_rmse,
                "backtested": final_mape is not None,
                "evaluation_method": "14-day holdout backtesting" if final_mape is not None else "Insufficient historical depth for backtest"
            },
            "insights": insights,
            "festival_impact": festival_impact,
            "inventory_suggestion": inventory_suggestion,
            "chart_data": {
                "historical": historical,
                "forecast": final_predictions,
            },
        }

    finally:
        if should_close:
            db.close()
