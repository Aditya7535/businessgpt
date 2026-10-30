import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_user, require_role
from app.models.user import User
from app.models.product import Product
from app.modules.market_intel.calendar import get_upcoming_festivals, get_active_month_opportunity, INDIAN_FESTIVALS_MASTER
from app.modules.market_intel.arrivals import NEW_MARKET_ARRIVALS, CATEGORY_MARKET_INTELLIGENCE
from app.modules.market_intel.trends import get_google_trends, get_market_recommendation
from app.modules.market_intel.news import get_business_news

logger = logging.getLogger(__name__)

router = APIRouter()


class TrendsRequest(BaseModel):
    category: str
    region: str = "IN"


class AdoptProductRequest(BaseModel):
    name: str
    sku: Optional[str] = None
    category: str = "Grocery"
    unit_price: float = Field(..., gt=0)
    cost_price: Optional[float] = None
    unit: str = "pcs"
    reorder_point: int = 15
    initial_stock: int = 0


# ─── 1. Indian Festivals & Demand Surge Calendar ─────────────────────────────
@router.get("/market/seasonal")
async def get_seasonal_opportunities():
    """
    Returns upcoming Indian festivals, festive demand surge windows,
    and seasonal preparation calendars.
    """
    try:
        festivals = get_upcoming_festivals(limit=6)
        active_opp = get_active_month_opportunity()

        return {
            "festivals": festivals,
            "current_month_opportunity": active_opp,
            "full_calendar": INDIAN_FESTIVALS_MASTER,
        }
    except Exception as e:
        logger.error(f"[Market Intel] Error fetching seasonal opportunities: {e}", exc_info=True)
        return {
            "festivals": get_upcoming_festivals(limit=6),
            "current_month_opportunity": None,
            "full_calendar": [],
        }


# ─── 2. New FMCG Market Arrivals ─────────────────────────────────────────────
@router.get("/market/new-arrivals")
async def get_new_market_arrivals(db: Session = Depends(get_db)):
    """
    Returns trending new market arrivals, high-demand product launches,
    and annotations whether the store already carries them.
    """
    try:
        # Cross-reference existing products in store catalog
        existing_names = {p.name.lower(): p.id for p in db.query(Product).all()}
        existing_skus = {p.sku.upper(): p.id for p in db.query(Product).all()}

        results = []
        for arr in NEW_MARKET_ARRIVALS:
            item = dict(arr)
            is_in_catalog = (
                arr["name"].lower() in existing_names or
                arr["sku"].upper() in existing_skus
            )
            item["already_in_catalog"] = is_in_catalog
            results.append(item)

        return {
            "arrivals": results,
            "count": len(results),
        }
    except Exception as e:
        logger.error(f"[Market Intel] Error fetching new arrivals: {e}", exc_info=True)
        return {"arrivals": NEW_MARKET_ARRIVALS, "count": len(NEW_MARKET_ARRIVALS)}


# ─── 3. Adopt / Add New Market Arrival to Catalog ────────────────────────────
@router.post("/market/adopt-product")
async def adopt_market_product(
    payload: AdoptProductRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER", "MANAGER"]))
):
    """
    Instantly adds a trending/new market product to the store's inventory catalog.
    """
    try:
        # Check if already exists by SKU or name
        sku_clean = (payload.sku or f"SKU-{payload.category[:4].upper()}-{payload.name[:3].upper()}").strip().upper()
        existing = db.query(Product).filter(
            (Product.sku == sku_clean) | (Product.name.ilike(payload.name.strip()))
        ).first()

        if existing:
            return {
                "message": f"Product '{existing.name}' ({existing.sku}) already exists in store catalog.",
                "product_id": existing.id,
                "already_existed": True
            }

        new_product = Product(
            name=payload.name.strip(),
            sku=sku_clean,
            category=payload.category,
            unit_price=float(payload.unit_price),
            current_stock=int(payload.initial_stock),
            reorder_point=int(payload.reorder_point),
            unit=payload.unit,
        )
        db.add(new_product)
        db.commit()
        db.refresh(new_product)

        logger.info(f"[Market Intel] User {current_user.id} adopted market product {new_product.name} ({new_product.sku})")
        return {
            "message": f"Product '{new_product.name}' successfully added to store inventory!",
            "product_id": new_product.id,
            "product": {
                "id": new_product.id,
                "name": new_product.name,
                "sku": new_product.sku,
                "category": new_product.category,
                "unit_price": new_product.unit_price,
                "current_stock": new_product.current_stock,
                "reorder_point": new_product.reorder_point,
                "unit": new_product.unit,
            },
            "already_existed": False
        }

    except Exception as e:
        db.rollback()
        logger.error(f"[Market Intel] Error adopting product: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to adopt market product: {str(e)}"
        )


# ─── 4. Category Demand Velocity & Trends ────────────────────────────────────
@router.post("/market/trends")
async def get_market_trends(request: TrendsRequest):
    """
    Returns regional consumer demand signals, velocity, trending products,
    and procurement playbook for the chosen merchandise category.
    """
    category = request.category or "Grocery"
    base_intel = CATEGORY_MARKET_INTELLIGENCE.get(
        category,
        CATEGORY_MARKET_INTELLIGENCE.get("Grocery")
    )

    # Provide immediate, responsive answers without long blocking network timeouts
    return {
        "category": category,
        "region": request.region,
        "direction": base_intel["direction"],
        "percentage": base_intel["percentage"],
        "velocity": base_intel["velocity"],
        "summary": base_intel["summary"],
        "high_demand_items": base_intel["high_demand_items"],
        "procurement_advice": base_intel["procurement_advice"],
        "top_brands": base_intel["top_brands"],
        # Backwards compatible fields for existing components
        "trending_products": base_intel["high_demand_items"],
        "trend_direction": base_intel["direction"],
        "trend_change_pct": float(base_intel["percentage"]),
        "seasonal_opportunity": base_intel["summary"],
        "competitor_insight": f"Top retailers maintaining 15-day forward cover on {', '.join(base_intel['top_brands'][:3])}.",
        "news_summary": base_intel["summary"],
        "recommendation": base_intel["procurement_advice"],
    }
