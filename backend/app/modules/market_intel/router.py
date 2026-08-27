from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.modules.market_intel.trends import get_google_trends, get_market_recommendation
from app.modules.market_intel.news import get_business_news

router = APIRouter()


class TrendsRequest(BaseModel):
    category: str
    region: str = "IN"


@router.post("/market/trends")
async def get_market_trends(request: TrendsRequest):
    """
    Get Google Trends data + News insights for a product category.
    """
    try:
        # Fetch both in parallel — if one fails, the other still returns
        trends_data = get_google_trends(request.category, request.region)
        news_data = get_business_news(request.category)

        recommendation = get_market_recommendation(request.category, trends_data)

        return {
            "category": request.category,
            "region": request.region,
            "trending_products": trends_data.get("trending_products", []),
            "trend_direction": trends_data.get("trend_direction", "stable"),
            "trend_change_pct": trends_data.get("trend_change_pct", 0.0),
            "seasonal_opportunity": trends_data.get("seasonal_opportunity", ""),
            "competitor_insight": news_data.get("competitor_insight", ""),
            "news_summary": news_data.get("news_summary", ""),
            "news_sentiment": news_data.get("sentiment", "neutral"),
            "recommendation": recommendation,
            "data_sources": {
                "trends": trends_data.get("source", "Google Trends"),
                "news": news_data.get("source", "NewsAPI"),
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Market intelligence error: {str(e)}")


@router.get("/market/seasonal")
async def get_seasonal_opportunities():
    """
    Returns Indian seasonal business calendar — which months to prepare for.
    """
    from app.modules.market_intel.trends import INDIAN_SEASONAL_OPPORTUNITIES
    from datetime import date

    current_month = date.today().month
    next_month = (current_month % 12) + 1

    return {
        "current_month_opportunity": INDIAN_SEASONAL_OPPORTUNITIES.get(current_month),
        "next_month_opportunity": INDIAN_SEASONAL_OPPORTUNITIES.get(next_month),
        "full_calendar": INDIAN_SEASONAL_OPPORTUNITIES,
    }
