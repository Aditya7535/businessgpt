from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.health.scorer import compute_health_score

router = APIRouter()


@router.get("/health/score")
async def get_health_score(db: Session = Depends(get_db)):
    """Returns the Business Health Score (0-100) with breakdown."""
    return compute_health_score(db)
