import os
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User
from app.modules.reports.generator import generate_pdf_report, REPORTS_DIR

router = APIRouter()


class ReportRequest(BaseModel):
    period: Optional[str] = "monthly"   # daily / weekly / monthly
    month: Optional[str] = ""           # e.g. "January 2024" or date string
    target_date: Optional[str] = None   # e.g. "2026-10-15"
    start_date: Optional[str] = None    # e.g. "2026-10-01"
    end_date: Optional[str] = None      # e.g. "2026-10-15"


@router.get("/reports/")
@router.get("/reports")
async def get_reports(current_user: User = Depends(require_role(["MANAGER", "OWNER"]))):
    """List all previously generated PDF reports sorted by creation date."""
    if not os.path.exists(REPORTS_DIR):
        return []

    reports = []
    try:
        files = os.listdir(REPORTS_DIR)
        for f in files:
            if not f.endswith(".pdf"):
                continue
            filepath = os.path.join(REPORTS_DIR, f)
            if not os.path.isfile(filepath):
                continue

            stat = os.stat(filepath)
            mtime = stat.st_mtime
            created_at = datetime.fromtimestamp(mtime).strftime("%d %b %Y, %I:%M %p")

            # Determine report type from filename: businessgpt_report_<type>_<timestamp>.pdf
            lower_name = f.lower()
            if "daily" in lower_name:
                report_type = "Daily Register"
            elif "weekly" in lower_name:
                report_type = "Weekly Briefing"
            elif "monthly" in lower_name:
                report_type = "Monthly Audit"
            else:
                report_type = "Business Report"

            reports.append({
                "filename": f,
                "report_type": report_type,
                "created_at": created_at,
                "size_kb": round(stat.st_size / 1024, 1),
                "timestamp": mtime
            })

        # Sort descending by timestamp (newest first)
        reports.sort(key=lambda x: x["timestamp"], reverse=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read reports: {str(e)}")

    return reports


@router.post("/reports/generate")
async def create_report(
    report_type: Optional[str] = Query(None),
    target_date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    request: Optional[ReportRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["MANAGER", "OWNER"]))
):
    """Generate a PDF business intelligence report."""
    try:
        period = (request.period if request and request.period else None) or report_type or "monthly"
        period_label = (request.month if request and request.month else None) or ""
        t_date = (request.target_date if request and request.target_date else None) or target_date
        s_date = (request.start_date if request and request.start_date else None) or start_date
        e_date = (request.end_date if request and request.end_date else None) or end_date

        filepath = generate_pdf_report(
            db=db,
            period=period,
            period_label=period_label,
            target_date=t_date,
            start_date=s_date,
            end_date=e_date
        )
        filename = os.path.basename(filepath)
        return {
            "message": "Report generated successfully",
            "filename": filename,
            "report_type": period,
            "created_at": datetime.now().strftime("%d %b %Y, %I:%M %p")
        }
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation error: {str(e)}")


BASE_DIR = Path(__file__).parent.parent.parent
REPORTS_DIR = BASE_DIR / "data" / "reports"


@router.get("/reports/download/{filename}")
@router.get("/download/{filename}")
async def download_report(
    filename: str,
    current_user: User = Depends(require_role(["MANAGER", "OWNER"]))
):
    safe_filename = os.path.basename(filename)
    file_path = REPORTS_DIR / safe_filename
    print(f"Looking for report at: {file_path}")
    print(f"File exists: {file_path.exists()}")
    if not file_path.exists():
        fallback = Path("app/data/reports") / safe_filename
        if fallback.exists():
            file_path = fallback
        else:
            raise HTTPException(404, f"File not found: {file_path}")

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=safe_filename,
        headers={"Content-Disposition": f"attachment; filename={safe_filename}"}
    )

