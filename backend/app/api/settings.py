import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User
from app.models.store_setting import StoreSetting

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULT_STORE_SETTINGS = {
    "business_name": "Bharat General Store & Supermart",
    "owner_name": "Aditya",
    "address": "Shop No. 12, Main Market, MG Road, Mumbai, Maharashtra 400001",
    "gstin": "27AABCB1234F1Z5",
    "phone": "+91 98765 43210",
    "currency": "₹",
    "tax_rates": [5, 12, 18, 28],
    "default_tax_rate": 5,
    "theme": "dark",
    "low_stock_notification": True,
    "daily_summary_notification": True,
    "auto_backup": True
}


def _deserialize(val_str: str) -> Any:
    try:
        return json.loads(val_str)
    except Exception:
        return val_str


def _serialize(val: Any) -> str:
    if isinstance(val, (dict, list, bool, int, float)):
        return json.dumps(val)
    return str(val)


def get_all_settings_from_db(db: Session) -> Dict[str, Any]:
    rows = db.query(StoreSetting).all()
    if not rows:
        # Fallback to defaults and seed them
        for k, v in DEFAULT_STORE_SETTINGS.items():
            db.add(StoreSetting(key=k, value=_serialize(v)))
        db.commit()
        rows = db.query(StoreSetting).all()

    result = dict(DEFAULT_STORE_SETTINGS)
    for r in rows:
        result[r.key] = _deserialize(r.value)
    return result


class StoreSettingsUpdate(BaseModel):
    business_name: Optional[str] = None
    owner_name: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    default_tax_rate: Optional[int] = None
    theme: Optional[str] = None
    low_stock_notification: Optional[bool] = None
    daily_summary_notification: Optional[bool] = None


@router.get("/")
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["EMPLOYEE", "MANAGER", "OWNER"]))
):
    """Retrieve store configuration settings from PostgreSQL."""
    return get_all_settings_from_db(db)


@router.post("/update")
def update_settings(
    payload: StoreSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER"]))
):
    """Update store configuration settings in PostgreSQL (Owner only)."""
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)

    for key, value in updates.items():
        if isinstance(value, str):
            value = value.strip()
        str_val = _serialize(value)
        setting = db.query(StoreSetting).filter(StoreSetting.key == key).first()
        if setting:
            setting.value = str_val
        else:
            db.add(StoreSetting(key=key, value=str_val))

    db.commit()
    all_settings = get_all_settings_from_db(db)
    return {"message": "Settings updated successfully.", "settings": all_settings}
