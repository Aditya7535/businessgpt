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

    # 1. Out-of-sample holdout backtest for honest MAPE evaluation
    backtest_mape = None
    if len(df) >= 30:
        test_days = min(14, len(df) // 4)
        train_split = df.iloc[:-test_days]
        test_split = df.iloc[-test_days:]

        X_eval_train = train_split[available_features].values
        y_eval_train = train_split["y"].values
        X_eval_test = test_split[available_features].values
        y_eval_test = test_split["y"].values

        try:
            eval_model = RandomForestRegressor(
                n_estimators=100,
                max_depth=6,
                min_samples_split=2,
                random_state=42,
                n_jobs=-1
            )
            eval_model.fit(X_eval_train, y_eval_train)
            eval_preds = eval_model.predict(X_eval_test).clip(min=0)
            nonzero_mask = y_eval_test > 0
            if nonzero_mask.sum() > 0:
                backtest_mape = float(np.mean(np.abs((y_eval_test[nonzero_mask] - eval_preds[nonzero_mask]) / y_eval_test[nonzero_mask])) * 100)
        except Exception:
            backtest_mape = None

    # 2. Fit on full data for future horizon forecast
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

    return {
        "predictions": predictions,
        "mape": round(backtest_mape, 2) if backtest_mape is not None else None,
        "backtested": backtest_mape is not None,
        "model": "random_forest"
    }
