from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.dataset import Dataset
from app.modules.inventory.engine import analyze_all_products
from app.modules.inventory.health_score import compute_inventory_health_score, get_inventory_alerts

router = APIRouter()


class InventoryRequest(BaseModel):
    product: Optional[str] = None      # None = analyze all products
    dataset_id: Optional[int] = None   # None = use latest dataset


# ── Column auto-detection helpers ──

def _detect_col(columns: list, keywords: list) -> Optional[str]:
    for kw in keywords:
        if kw in columns:
            return kw
    for col in columns:
        if any(k in col.lower() for k in keywords):
            return col
    return None


@router.post("/inventory/analyze")
async def analyze_inventory(request: InventoryRequest, db: Session = Depends(get_db)):
    """
    Run the full inventory analysis for one or all products.
    Uses Phase 3 forecasting output when available.
    """
    dataset = _get_dataset(db, request.dataset_id)
    raw_data = dataset.data

    columns = list(raw_data[0].keys())
    date_col = _detect_col(columns, ["date", "order_date", "invoice_date", "month", "time"])
    sales_col = _detect_col(columns, ["quantity", "units", "qty", "sales", "revenue", "amount"])
    product_col = _detect_col(columns, ["product_name", "product", "item", "sku", "category"])
    stock_col = _detect_col(columns, ["stock", "current_stock", "inventory", "on_hand", "quantity_on_hand"])
    price_col = _detect_col(columns, ["price", "unit_price", "rate", "mrp", "cost"])

    if not date_col or not sales_col:
        raise HTTPException(
            status_code=400,
            detail=f"Date ya sales column detect nahi hua. Available: {columns}"
        )
    if not product_col:
        raise HTTPException(
            status_code=400,
            detail=f"Product column detect nahi hua. Available: {columns}"
        )

    results = analyze_all_products(
        data=raw_data,
        date_col=date_col,
        sales_col=sales_col,
        product_col=product_col,
        stock_col=stock_col,
        price_col=price_col,
        product_filter=request.product,
    )

    health = compute_inventory_health_score(results)

    return {
        "analysis": results,
        "health_score": health,
        "total_products": len(results),
    }


@router.get("/inventory/alerts")
async def get_alerts(dataset_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Returns categorized stock alerts: critical, low_stock, overstock, optimal.
    """
    dataset = _get_dataset(db, dataset_id)
    raw_data = dataset.data
    columns = list(raw_data[0].keys())

    date_col = _detect_col(columns, ["date", "order_date", "invoice_date", "month", "time"])
    sales_col = _detect_col(columns, ["quantity", "units", "qty", "sales", "revenue", "amount"])
    product_col = _detect_col(columns, ["product_name", "product", "item", "sku", "category"])
    stock_col = _detect_col(columns, ["stock", "current_stock", "inventory", "on_hand"])
    price_col = _detect_col(columns, ["price", "unit_price", "rate", "mrp", "cost"])

    if not date_col or not sales_col or not product_col:
        raise HTTPException(status_code=400, detail=f"Required columns missing. Available: {columns}")

    results = analyze_all_products(
        data=raw_data,
        date_col=date_col,
        sales_col=sales_col,
        product_col=product_col,
        stock_col=stock_col,
        price_col=price_col,
    )

    alerts = get_inventory_alerts(results)
    health = compute_inventory_health_score(results)

    return {
        **alerts,
        "health_score": health["score"],
        "health_grade": health["grade"],
    }


def _get_dataset(db: Session, dataset_id: Optional[int]) -> Dataset:
    if dataset_id:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    else:
        dataset = db.query(Dataset).order_by(Dataset.id.desc()).first()

    if not dataset or not dataset.data:
        raise HTTPException(
            status_code=404,
            detail="Koi dataset nahi mila. Pehle /api/upload se file upload karein."
        )
    return dataset
