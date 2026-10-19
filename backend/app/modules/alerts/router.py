from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User
from app.models.alert import Alert
from app.modules.alerts.checker import run_all_checks, save_alerts_to_db

router = APIRouter()


@router.get("/alerts")
@router.get("/alerts/")
async def get_all_alerts(db: Session = Depends(get_db), current_user: User = Depends(require_role(["MANAGER", "OWNER"]))):
    """Returns all alerts for the store (used by Alerts page). Auto-runs checks if empty."""
    alerts = (
        db.query(Alert)
        .order_by(Alert.created_at.desc())
        .limit(100)
        .all()
    )

    if not alerts:
        try:
            generated = run_all_checks(db)
            if generated:
                save_alerts_to_db(db, generated)
                alerts = (
                    db.query(Alert)
                    .order_by(Alert.created_at.desc())
                    .limit(100)
                    .all()
                )
        except Exception:
            pass

    return [
        {
            "id": a.id,
            "alert_type": a.alert_type,
            "type": a.alert_type,
            "severity": a.severity,
            "message": a.message,
            "is_read": a.is_read,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in alerts
    ]


@router.get("/alerts/pending")
async def get_pending_alerts(db: Session = Depends(get_db), current_user: User = Depends(require_role(["EMPLOYEE", "MANAGER", "OWNER"]))):
    """Returns all unread alerts sorted by severity and time, after auto-reconciling live inventory."""
    from app.modules.alerts.checker import reconcile_resolved_inventory_alerts
    reconcile_resolved_inventory_alerts(db)

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
async def generate_alerts_now(db: Session = Depends(get_db), current_user: User = Depends(require_role(["EMPLOYEE", "MANAGER", "OWNER"]))):
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
async def mark_alert_read(alert_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["MANAGER", "OWNER"]))):
    """Mark a specific alert as read."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert nahi mila.")
    alert.is_read = True
    db.commit()
    return {"message": "Alert marked as read."}


@router.patch("/alerts/read-all")
async def mark_all_alerts_read(db: Session = Depends(get_db), current_user: User = Depends(require_role(["MANAGER", "OWNER"]))):
    """Mark all pending alerts as read."""
    db.query(Alert).filter(Alert.is_read == False).update({"is_read": True})
    db.commit()
    return {"message": "Sab alerts read mark ho gaye."}
