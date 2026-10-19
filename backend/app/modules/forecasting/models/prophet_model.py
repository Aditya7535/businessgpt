import pandas as pd
import numpy as np
from typing import Dict, List
from app.modules.forecasting.features import build_prophet_holidays

def run_prophet(df: pd.DataFrame, horizon_days: int) -> Dict:
    """
    Trains a Prophet model on df['ds', 'y'] and forecasts for horizon_days.
    Evaluates out-of-sample holdout MAPE via backtesting (no in-sample fabrication).
    Enables yearly seasonality only when at least 365 days of data exist.
    """
    try:
        from prophet import Prophet
    except ImportError:
        raise ImportError("Prophet not installed. Run: pip install prophet")

    holidays = build_prophet_holidays()

    # Guard yearly seasonality: only valid if data spans >= 365 days
    span_days = (df["ds"].max() - df["ds"].min()).days
    enable_yearly = span_days >= 365

    # 1. Backtesting evaluation on holdout test set (if enough data)
    backtest_mape = None
    if len(df) >= 30:
        test_days = min(14, len(df) // 4)
        train_split = df.iloc[:-test_days][["ds", "y"]].copy()
        test_split = df.iloc[-test_days:][["ds", "y"]].copy()

        try:
            eval_model = Prophet(
                holidays=holidays,
                yearly_seasonality=enable_yearly,
                weekly_seasonality=True,
                daily_seasonality=False,
                interval_width=0.80,
                changepoint_prior_scale=0.05,
            )
            eval_model.add_country_holidays(country_name="IN")
            eval_model.fit(train_split)
            eval_future = eval_model.make_future_dataframe(periods=test_days, freq="D")
            eval_fc = eval_model.predict(eval_future)

            eval_test = eval_fc[eval_fc["ds"] > train_split["ds"].max()]
            actuals = test_split["y"].values
            preds = eval_test["yhat"].values[:len(actuals)]

            nonzero_mask = actuals > 0
            if nonzero_mask.sum() > 0:
                backtest_mape = float(np.mean(np.abs((actuals[nonzero_mask] - preds[nonzero_mask]) / actuals[nonzero_mask])) * 100)
        except Exception:
            backtest_mape = None

    # 2. Fit on full training data for future horizon forecast
    model = Prophet(
        holidays=holidays,
        yearly_seasonality=enable_yearly,
        weekly_seasonality=True,
        daily_seasonality=False,
        interval_width=0.80,
        changepoint_prior_scale=0.05,
    )
    model.add_country_holidays(country_name="IN")

    train_df = df[["ds", "y"]].copy()
    model.fit(train_df)

    # Build future dataframe
    future = model.make_future_dataframe(periods=horizon_days, freq="D")
    forecast = model.predict(future)

    # Extract only the forecast portion (after last training date)
    last_train_date = train_df["ds"].max()
    forecast_only = forecast[forecast["ds"] > last_train_date][
        ["ds", "yhat", "yhat_lower", "yhat_upper"]
    ].copy()

    # Clip negative predictions to 0
    forecast_only["yhat"] = forecast_only["yhat"].clip(lower=0).round(2)
    forecast_only["yhat_lower"] = forecast_only["yhat_lower"].clip(lower=0).round(2)
    forecast_only["yhat_upper"] = forecast_only["yhat_upper"].clip(lower=0).round(2)

    predictions = [
        {
            "date": row["ds"].strftime("%Y-%m-%d"),
            "predicted": row["yhat"],
            "lower": row["yhat_lower"],
            "upper": row["yhat_upper"],
        }
        for _, row in forecast_only.iterrows()
    ]

    return {
        "predictions": predictions,
        "mape": round(backtest_mape, 2) if backtest_mape is not None else None,
        "backtested": backtest_mape is not None,
        "model": "prophet"
    }
