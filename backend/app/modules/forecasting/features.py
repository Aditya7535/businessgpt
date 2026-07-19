import pandas as pd
import numpy as np
from datetime import date, timedelta
from typing import List, Dict

# ─────────────────────────────────────────────
#  STEP 1: Indian Festival Calendar (2024-2027)
# ─────────────────────────────────────────────

INDIAN_FESTIVALS: Dict[str, List[str]] = {
    # ── Diwali (varies by year, approx Oct-Nov) ──
    "Diwali": ["2024-11-01", "2025-10-20", "2026-11-08", "2027-10-29"],
    # ── Holi ──
    "Holi": ["2024-03-25", "2025-03-14", "2026-03-03", "2027-03-22"],
    # ── Eid ul-Fitr (approx) ──
    "Eid": ["2024-04-10", "2025-03-30", "2026-03-20", "2027-03-09"],
    # ── Christmas ──
    "Christmas": ["2024-12-25", "2025-12-25", "2026-12-25", "2027-12-25"],
    # ── New Year ──
    "New_Year": ["2024-01-01", "2025-01-01", "2026-01-01", "2027-01-01"],
    # ── Navratri (Oct edition, approx) ──
    "Navratri": ["2024-10-03", "2025-09-22", "2026-10-11", "2027-10-01"],
    # ── Durga Puja (approx same as Navratri end) ──
    "Durga_Puja": ["2024-10-12", "2025-10-01", "2026-10-20", "2027-10-09"],
    # ── Ganesh Chaturthi ──
    "Ganesh_Chaturthi": ["2024-09-07", "2025-08-27", "2026-08-16", "2027-09-04"],
    # ── Independence Day ──
    "Independence_Day": ["2024-08-15", "2025-08-15", "2026-08-15", "2027-08-15"],
    # ── Republic Day ──
    "Republic_Day": ["2024-01-26", "2025-01-26", "2026-01-26", "2027-01-26"],
    # ── Valentine's Day ──
    "Valentines_Day": ["2024-02-14", "2025-02-14", "2026-02-14", "2027-02-14"],
    # ── Raksha Bandhan ──
    "Raksha_Bandhan": ["2024-08-19", "2025-08-09", "2026-08-29", "2027-08-18"],
    # ── Onam ──
    "Onam": ["2024-09-15", "2025-09-05", "2026-08-25", "2027-09-13"],
    # ── Pongal ──
    "Pongal": ["2024-01-15", "2025-01-14", "2026-01-14", "2027-01-14"],
}

# IPL Season: April 1 – May 31 each year
IPL_SEASONS = [(date(y, 4, 1), date(y, 5, 31)) for y in range(2024, 2028)]

# Window (days) around each festival to consider as "high demand"
FESTIVAL_WINDOW_DAYS = 7


def _get_festival_dates_flat() -> Dict[str, date]:
    """Returns {date_str: festival_name} for all festival dates."""
    mapping = {}
    for festival, dates in INDIAN_FESTIVALS.items():
        for d in dates:
            mapping[d] = festival
    return mapping


def _is_ipl_season(d: date) -> bool:
    for start, end in IPL_SEASONS:
        if start <= d <= end:
            return True
    return False


# ─────────────────────────────────────────────
#  STEP 2: Feature Engineering
# ─────────────────────────────────────────────

def add_time_features(df: pd.DataFrame, date_col: str = "ds") -> pd.DataFrame:
    """
    Add calendar + festival features to a DataFrame that already has a 'ds' column.
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])

    # Basic time features
    df["day_of_week"] = df[date_col].dt.dayofweek          # 0=Mon
    df["day_of_month"] = df[date_col].dt.day
    df["week_of_year"] = df[date_col].dt.isocalendar().week.astype(int)
    df["month"] = df[date_col].dt.month
    df["quarter"] = df[date_col].dt.quarter
    df["year"] = df[date_col].dt.year
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["is_month_start"] = df[date_col].dt.is_month_start.astype(int)
    df["is_month_end"] = df[date_col].dt.is_month_end.astype(int)

    # Festival features
    festival_flat = _get_festival_dates_flat()

    # Binary: 1 if within FESTIVAL_WINDOW_DAYS of any festival
    df["is_festival_period"] = 0
    df["festival_name"] = "none"
    df["days_to_festival"] = 99  # sentinel

    for idx, row in df.iterrows():
        d = row[date_col].date()
        min_days = 99
        nearest = "none"
        for fest_date_str, fest_name in festival_flat.items():
            fest_date = date.fromisoformat(fest_date_str)
            diff = abs((d - fest_date).days)
            if diff <= FESTIVAL_WINDOW_DAYS and diff < min_days:
                min_days = diff
                nearest = fest_name

        if nearest != "none":
            df.at[idx, "is_festival_period"] = 1
            df.at[idx, "festival_name"] = nearest
            df.at[idx, "days_to_festival"] = min_days

    # IPL season feature
    df["is_ipl_season"] = df[date_col].apply(lambda x: int(_is_ipl_season(x.date())))

    return df


def build_prophet_holidays() -> pd.DataFrame:
    """
    Returns a DataFrame in Prophet's holiday format:
    columns: ['holiday', 'ds', 'lower_window', 'upper_window']
    """
    rows = []
    for festival, dates in INDIAN_FESTIVALS.items():
        for d in dates:
            rows.append({
                "holiday": festival,
                "ds": pd.Timestamp(d),
                "lower_window": -FESTIVAL_WINDOW_DAYS,
                "upper_window": FESTIVAL_WINDOW_DAYS,
            })
    # Add IPL season rows
    for start, end in IPL_SEASONS:
        current = start
        while current <= end:
            rows.append({
                "holiday": "IPL_Season",
                "ds": pd.Timestamp(current),
                "lower_window": 0,
                "upper_window": 0,
            })
            current += timedelta(days=1)

    return pd.DataFrame(rows)


def prepare_dataframe(raw_data: list[dict], date_col: str, sales_col: str,
                      product_filter: str | None = None,
                      product_col: str | None = None) -> pd.DataFrame:
    """
    Converts raw PostgreSQL JSON data into a clean training DataFrame.
    Returns df with ['ds', 'y'] + feature columns.
    Raises ValueError if data is insufficient.
    """
    df = pd.DataFrame(raw_data)

    # Filter by product if requested
    if product_filter and product_col and product_col in df.columns:
        df = df[df[product_col].astype(str).str.lower() == product_filter.lower()]

    if date_col not in df.columns or sales_col not in df.columns:
        raise ValueError(f"Required columns not found. Available: {list(df.columns)}")

    df = df[[date_col, sales_col]].rename(columns={date_col: "ds", sales_col: "y"})
    df["ds"] = pd.to_datetime(df["ds"], errors="coerce")
    df["y"] = pd.to_numeric(df["y"], errors="coerce")
    df = df.dropna().sort_values("ds").reset_index(drop=True)

    if len(df) < 10:
        raise ValueError("Forecasting ke liye kam se kam 10 rows chahiye. Please zyada data upload karein.")

    df = add_time_features(df)
    return df


def get_festival_impact_for_period(start_date: date, end_date: date) -> Dict[str, str]:
    """
    Returns dict of festivals that fall in the forecast horizon with estimated % boost.
    """
    impact = {}
    for festival, dates in INDIAN_FESTIVALS.items():
        for d_str in dates:
            d = date.fromisoformat(d_str)
            if start_date <= d <= end_date:
                # Rough impact heuristics based on festival type
                if festival in ["Diwali", "Holi", "Eid"]:
                    impact[festival.replace("_", " ")] = "+20 to +35%"
                elif festival in ["Navratri", "Durga_Puja", "Ganesh_Chaturthi"]:
                    impact[festival.replace("_", " ")] = "+10 to +20%"
                elif festival in ["Christmas", "New_Year"]:
                    impact[festival.replace("_", " ")] = "+8 to +15%"
                else:
                    impact[festival.replace("_", " ")] = "+5 to +12%"
    if _is_ipl_season(start_date) or _is_ipl_season(end_date):
        impact["IPL Season"] = "+5 to +15% (electronics/beverages)"
    return impact
