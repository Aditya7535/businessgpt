import pandas as pd
import numpy as np
from typing import Dict

FEATURE_COLS = [
    "day_of_week", "day_of_month", "week_of_year", "month",
    "quarter", "year", "is_weekend", "is_month_start", "is_month_end",
    "is_festival_period", "days_to_festival", "is_ipl_season"
]

def run_random_forest(df: pd.DataFrame, horizon_days: int) -> Dict:
    """
    Trains a Random Forest regressor and generates forecast for horizon_days.
    """
    from sklearn.ensemble import RandomForestRegressor
    from app.modules.forecasting.features import add_time_features

    available_features = [c for c in FEATURE_COLS if c in df.columns]

    X_train = df[available_features].values
    y_train = df["y"].values

    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=8,
        min_samples_split=2,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    # Build future feature rows
    last_date = df["ds"].max()
    future_dates = pd.date_range(
        start=last_date + pd.Timedelta(days=1),
        periods=horizon_days,
        freq="D"
    )
    future_df = pd.DataFrame({"ds": future_dates})
    future_df = add_time_features(future_df)
    available_future = [c for c in FEATURE_COLS if c in future_df.columns]
    X_future = future_df[available_future].values

    preds = model.predict(X_future).clip(min=0)

    # Use tree variance as confidence interval proxy
    all_tree_preds = np.array([tree.predict(X_future) for tree in model.estimators_])
    std = all_tree_preds.std(axis=0)

    predictions = [
        {
            "date": future_df["ds"].iloc[i].strftime("%Y-%m-%d"),
            "predicted": round(float(preds[i]), 2),
            "lower": round(max(0, float(preds[i] - 1.5 * std[i])), 2),
            "upper": round(float(preds[i] + 1.5 * std[i]), 2),
        }
        for i in range(horizon_days)
    ]

    # In-sample MAPE
    in_sample_preds = model.predict(X_train).clip(min=0)
    nonzero_mask = y_train != 0
    if nonzero_mask.sum() > 0:
        mape = float(np.mean(np.abs((y_train[nonzero_mask] - in_sample_preds[nonzero_mask]) / y_train[nonzero_mask])) * 100)
    else:
        mape = 0.0

    return {
        "predictions": predictions,
        "mape": round(mape, 2),
        "model": "random_forest"
    }
