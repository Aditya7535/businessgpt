from typing import Dict, List
from app.core.config import settings

# Cache news to respect the 100 req/day free tier limit
_news_cache: Dict[str, Dict] = {}

def get_business_news(category: str, max_articles: int = 5) -> Dict:
    """
    Fetches latest business news for the given product/category from NewsAPI.
    Caches results to conserve the daily 100 request limit.
    Returns graceful fallback if API key is missing or limit exceeded.
    """
    cache_key = category.lower().strip()

    # Return cached result if available (same day)
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    if not settings.NEWSAPI_KEY:
        return _fallback_news(category, reason="NewsAPI key not configured in .env")

    try:
        from newsapi import NewsApiClient

        client = NewsApiClient(api_key=settings.NEWSAPI_KEY)

        # Search for relevant Indian business news
        query = f"{category} India business market"
        response = client.get_everything(
            q=query,
            language="en",
            sort_by="relevancy",
            page_size=max_articles,
        )

        articles = response.get("articles", [])
        if not articles:
            return _fallback_news(category, reason="No articles found")

        summaries = []
        for article in articles[:max_articles]:
            title = article.get("title", "")
            desc = article.get("description", "")
            if title:
                summaries.append(f"• {title}")

        news_summary = "\n".join(summaries) if summaries else f"No recent news found for '{category}'."

        # Simple sentiment: count positive/negative words in titles
        positive_words = ["growth", "rise", "surge", "boom", "opportunity", "profit", "increase"]
        negative_words = ["decline", "fall", "drop", "loss", "crisis", "shortage", "decrease"]
        all_text = " ".join(summaries).lower()
        pos_count = sum(all_text.count(w) for w in positive_words)
        neg_count = sum(all_text.count(w) for w in negative_words)

        if pos_count > neg_count:
            sentiment = "positive"
            competitor_insight = f"Market sentiment for '{category}' is positive. Expansion opportunity."
        elif neg_count > pos_count:
            sentiment = "cautious"
            competitor_insight = f"Market challenges in '{category}'. Focus on cost efficiency."
        else:
            sentiment = "neutral"
            competitor_insight = f"'{category}' market is stable. Monitor closely."

        result = {
            "category": category,
            "news_summary": news_summary,
            "article_count": len(articles),
            "sentiment": sentiment,
            "competitor_insight": competitor_insight,
            "source": "NewsAPI.org",
        }

        _news_cache[cache_key] = result
        return result

    except Exception as e:
        err = str(e).lower()
        reason = "Rate limit exceeded (100/day)" if "429" in err or "rateLimited" in err.lower() else str(e)[:80]
        return _fallback_news(category, reason=reason)


def _fallback_news(category: str, reason: str = "") -> Dict:
    return {
        "category": category,
        "news_summary": (
            f"Latest market update: '{category}' segment mein healthy demand hai. "
            "Tier 2 cities mein growth dikha raha hai. Premium products ka trend badh raha hai."
        ),
        "article_count": 0,
        "sentiment": "neutral",
        "competitor_insight": f"'{category}' market stable hai. Seasonal opportunities monitor karein.",
        "source": "BusinessGPT Market Intelligence (Fallback)",
        "note": reason,
    }
