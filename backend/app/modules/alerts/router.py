from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.alert import Alert
from app.modules.alerts.checker import run_all_checks, save_alerts_to_db

router = APIRouter()


@router.get("/alerts/pending")
async def get_pending_alerts(db: Session = Depends(get_db)):
    """Returns all unread alerts sorted by severity and time."""
    alerts = (
        db.query(Alert)
        .filter(Alert.is_read == False)
        .order_by(Alert.created_at.desc())
        .limit(50)
        .all()
    )

    severity_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    alerts_sorted = sorted(alerts, key=lambda a: severity_order.get(a.severity, 3))

    return {
        "alerts": [
            {
                "id": a.id,
                "type": a.alert_type,
                "severity": a.severity,
                "message": a.message,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in alerts_sorted
        ],
        "unread_count": len(alerts),
    }


@router.post("/alerts/generate")
async def generate_alerts_now(db: Session = Depends(get_db)):
    """Manually trigger alert generation (useful for testing)."""
    try:
        alerts = run_all_checks(db)
        save_alerts_to_db(db, alerts)
        return {
            "generated": len(alerts),
            "message": f"{len(alerts)} alerts generate ho gaye.",
            "alerts": [a["message"] for a in alerts],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Alert generation error: {str(e)}")


@router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: int, db: Session = Depends(get_db)):
    """Mark a specific alert as read."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert nahi mila.")
    alert.is_read = True
    db.commit()
    return {"message": "Alert marked as read."}


@router.patch("/alerts/read-all")
async def mark_all_alerts_read(db: Session = Depends(get_db)):
    """Mark all pending alerts as read."""
    db.query(Alert).filter(Alert.is_read == False).update({"is_read": True})
    db.commit()
    return {"message": "Sab alerts read mark ho gaye."}
