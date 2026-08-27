import time
import pandas as pd
from typing import Dict, List, Optional

# Seasonal business opportunities for Indian market
INDIAN_SEASONAL_OPPORTUNITIES = {
    1: "Republic Day sales + Winter clearance",
    2: "Valentine's Day gifting demand rising",
    3: "Holi festival purchases",
    4: "IPL season — electronics, beverages, snacks trending",
    5: "Summer peak — cooling products, beverages",
    6: "Monsoon prep — rainwear, medicines",
    7: "Monsoon ongoing — comfort foods trending",
    8: "Independence Day + Raksha Bandhan gifting",
    9: "Navratri + Ganesh Chaturthi festival season starting",
    10: "Diwali mega season — highest sales opportunity",
    11: "Post-Diwali + Children's Day",
    12: "Christmas + New Year + Winter shopping",
}

def get_google_trends(category: str, region: str = "IN") -> Dict:
    """
    Fetches Google Trends data for the given category/keyword.
    Returns trending products, direction, and insights.
    Includes 2-second delay to respect rate limits.
    """
    try:
        from pytrends.request import TrendReq

        pytrends = TrendReq(hl="en-IN", tz=330, timeout=(10, 25))

        # Build keyword list (category + related terms)
        base_keywords = [category]
        time.sleep(2)  # Respect rate limits

        pytrends.build_payload(
            base_keywords,
            cat=0,
            timeframe="today 3-m",
            geo=region,
        )

        # Interest over time
        time.sleep(1)
        interest_df = pytrends.interest_over_time()

        # Related queries — trending searches
        time.sleep(2)
        related = pytrends.related_queries()
        rising_queries = []

        if related and category in related:
            rising_data = related[category].get("rising")
            if rising_data is not None and not rising_data.empty:
                rising_queries = rising_data["query"].head(5).tolist()

        # Determine trend direction from interest over time
        trend_direction = "stable"
        trend_pct = 0.0
        if not interest_df.empty and category in interest_df.columns:
            vals = interest_df[category].dropna()
            if len(vals) >= 4:
                recent = vals[-4:].mean()
                older = vals[-8:-4].mean() if len(vals) >= 8 else vals[:4].mean()
                if older > 0:
                    trend_pct = ((recent - older) / older) * 100
                if trend_pct > 10:
                    trend_direction = "rising"
                elif trend_pct < -10:
                    trend_direction = "falling"

        from datetime import date
        month = date.today().month
        seasonal_opp = INDIAN_SEASONAL_OPPORTUNITIES.get(month, "Regular season")

        return {
            "category": category,
            "region": region,
            "trending_products": rising_queries if rising_queries else [f"{category} premium", f"{category} organic", f"best {category}"],
            "trend_direction": trend_direction,
            "trend_change_pct": round(trend_pct, 1),
            "seasonal_opportunity": seasonal_opp,
            "source": "Google Trends",
            "data_period": "Last 3 months",
        }

    except Exception as e:
        err = str(e).lower()
        # Graceful fallback with seasonal data
        from datetime import date
        month = date.today().month
        seasonal_opp = INDIAN_SEASONAL_OPPORTUNITIES.get(month, "Regular season")

        # Check if it's a rate limit or network issue
        if "429" in err or "too many" in err:
            error_msg = "Google Trends rate limit hit. Using cached seasonal data."
        elif "timeout" in err:
            error_msg = "Google Trends timeout. Using seasonal data."
        else:
            error_msg = f"Google Trends unavailable: {str(e)[:80]}"

        return {
            "category": category,
            "region": region,
            "trending_products": [f"premium {category}", f"organic {category}", f"discount {category}"],
            "trend_direction": "stable",
            "trend_change_pct": 0.0,
            "seasonal_opportunity": seasonal_opp,
            "source": "Seasonal Calendar (Fallback)",
            "note": error_msg,
        }


def get_market_recommendation(category: str, trends_data: Dict) -> str:
    """Returns a business recommendation based on trend data."""
    direction = trends_data.get("trend_direction", "stable")
    trending = trends_data.get("trending_products", [])
    seasonal = trends_data.get("seasonal_opportunity", "")

    if direction == "rising":
        rec = f"'{category}' category mein demand badh rahi hai! "
        if trending:
            rec += f"Trending products: {', '.join(trending[:3])}. Inhe stock karein."
    elif direction == "falling":
        rec = f"'{category}' category mein demand gir rahi hai. Inventory reduce karein aur discounts try karein."
    else:
        rec = f"'{category}' category stable hai. "
        if seasonal:
            rec += f"Seasonal opportunity: {seasonal}."

    return rec
