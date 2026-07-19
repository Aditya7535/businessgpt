from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.dataset import Dataset
from app.modules.forecasting.engine import run_forecast

router = APIRouter()


class ForecastRequest(BaseModel):
    product: Optional[str] = None        # None = all products combined
    horizon: str = "month"               # week / month / quarter
    include_festivals: bool = True
    dataset_id: Optional[int] = None    # None = use latest uploaded dataset


@router.post("/forecast/sales")
async def forecast_sales(request: ForecastRequest, db: Session = Depends(get_db)):
    """
    Generate sales forecasts using the ensemble ML model.
    Auto-selects Prophet / XGBoost / RandomForest based on data size.
    """
    # Fetch data from PostgreSQL
    if request.dataset_id:
        dataset = db.query(Dataset).filter(Dataset.id == request.dataset_id).first()
    else:
        dataset = db.query(Dataset).order_by(Dataset.id.desc()).first()

    if not dataset:
        raise HTTPException(
            status_code=404,
            detail="Koi dataset nahi mila. Pehle /api/upload se CSV/Excel file upload karein."
        )

    raw_data = dataset.data
    if not raw_data:
        raise HTTPException(status_code=400, detail="Dataset mein koi data nahi hai.")

    # Auto-detect date and sales columns
    sample = raw_data[0]
    columns = list(sample.keys())
    
    date_col = _detect_date_column(columns)
    sales_col = _detect_sales_column(columns)
    product_col = _detect_product_column(columns)

    if not date_col:
        raise HTTPException(
            status_code=400,
            detail=f"Date column nahi mila. Available columns: {columns}. "
                   "Apni file mein 'date', 'Date', 'order_date' jaisa column rakhein."
        )
    if not sales_col:
        raise HTTPException(
            status_code=400,
            detail=f"Sales column nahi mila. Available columns: {columns}. "
                   "Apni file mein 'sales', 'Sales', 'revenue', 'quantity' jaisa column rakhein."
        )

    try:
        result = run_forecast(
            raw_data=raw_data,
            date_col=date_col,
            sales_col=sales_col,
            horizon=request.horizon,
            product_filter=request.product,
            product_col=product_col,
            include_festivals=request.include_festivals,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")


# ── Column auto-detection helpers ──

def _detect_date_column(columns: list) -> Optional[str]:
    date_keywords = ["date", "Date", "ORDER_DATE", "order_date", "invoice_date",
                     "transaction_date", "month", "Month", "week", "time", "timestamp"]
    for kw in date_keywords:
        if kw in columns:
            return kw
    # Fuzzy match
    for col in columns:
        if any(k in col.lower() for k in ["date", "time", "month", "week"]):
            return col
    return None


def _detect_sales_column(columns: list) -> Optional[str]:
    sales_keywords = ["sales", "Sales", "revenue", "Revenue", "amount", "Amount",
                      "quantity", "Quantity", "total", "Total", "units", "Units",
                      "sales_amount", "sale_price", "net_sales"]
    for kw in sales_keywords:
        if kw in columns:
            return kw
    for col in columns:
        if any(k in col.lower() for k in ["sale", "revenue", "amount", "qty", "unit", "total"]):
            return col
    return None


def _detect_product_column(columns: list) -> Optional[str]:
    product_keywords = ["product", "Product", "item", "Item", "sku", "SKU",
                        "product_name", "category", "Category"]
    for kw in product_keywords:
        if kw in columns:
            return kw
    for col in columns:
        if any(k in col.lower() for k in ["product", "item", "sku", "category"]):
            return col
    return None
