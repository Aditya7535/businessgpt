import os
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.modules.reports.generator import generate_pdf_report

router = APIRouter()


class ReportRequest(BaseModel):
    period: str = "monthly"   # weekly / monthly
    month: str = ""           # e.g. "January 2024"


@router.post("/reports/generate")
async def create_report(request: ReportRequest, db: Session = Depends(get_db)):
    """Generate a PDF business intelligence report and return it as a download."""
    try:
        period_label = request.month or datetime.now().strftime("%B %Y")
        filepath = generate_pdf_report(db, period=request.period, period_label=period_label)
        filename = os.path.basename(filepath)
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except ImportError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Report generation error: {str(e)}")
