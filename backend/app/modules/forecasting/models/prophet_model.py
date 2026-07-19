import pandas as pd
import numpy as np
from typing import Dict, List
from app.modules.forecasting.features import build_prophet_holidays

def run_prophet(df: pd.DataFrame, horizon_days: int) -> Dict:
    """
    Trains a Prophet model on df['ds', 'y'] and forecasts for horizon_days.
    Returns dict with predictions and MAPE accuracy.
    """
    try:
        from prophet import Prophet
    except ImportError:
        raise ImportError("Prophet not installed. Run: pip install prophet")

    holidays = build_prophet_holidays()

    model = Prophet(
        holidays=holidays,
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        interval_width=0.80,     # 80% confidence interval
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

    # Calculate in-sample MAPE on training data
    in_sample = forecast[forecast["ds"] <= last_train_date].copy()
    actual = train_df.set_index("ds")["y"]
    predicted = in_sample.set_index("ds")["yhat"]
    aligned = actual.align(predicted, join="inner")
    nonzero_mask = aligned[0] != 0
    if nonzero_mask.sum() > 0:
        mape = float(np.mean(np.abs((aligned[0][nonzero_mask] - aligned[1][nonzero_mask]) / aligned[0][nonzero_mask])) * 100)
    else:
        mape = 0.0

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
        "mape": round(mape, 2),
        "model": "prophet"
    }
