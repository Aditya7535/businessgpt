from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User
from app.modules.forecasting.engine import run_forecast

router = APIRouter()


class ForecastRequest(BaseModel):
    product: Optional[str] = None        # None = all products combined, or specific product name
    horizon: str = "month"               # week / month / quarter
    include_festivals: bool = True
    dataset_id: Optional[int] = None    # kept for backwards compatibility


@router.post("/forecast/sales")
async def forecast_sales(
    request: ForecastRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER", "MANAGER", "EMPLOYEE"]))
):
    """
    Generate sales forecasts directly on live PostgreSQL sales_data joined with products.
    Auto-selects Prophet / XGBoost / RandomForest ensemble based on data size.
    """
    try:
        result = run_forecast(
            db=db,
            horizon=request.horizon,
            product_filter=request.product,
            include_festivals=request.include_festivals,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {str(e)}")


@router.get("/forecast/sales")
async def get_forecast_sales(
    horizon: str = "month",
    product: Optional[str] = None,
    include_festivals: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER", "MANAGER", "EMPLOYEE"]))
):
    """GET endpoint variant for sales forecasts."""
    req = ForecastRequest(horizon=horizon, product=product, include_festivals=include_festivals)
    return await forecast_sales(req, db, current_user)
