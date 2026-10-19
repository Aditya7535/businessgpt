from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import (
    hash_pin,
    verify_pin,
    create_access_token,
    get_current_user,
    require_role
)
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    role: Optional[str] = Field(None, description="EMPLOYEE, MANAGER, or OWNER")
    user_id: Optional[int] = Field(None, description="Optional specific user ID")
    pin: str = Field(..., min_length=4, max_length=6, description="4 to 6 digit security PIN")


class UserOut(BaseModel):
    id: int
    name: str
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(..., description="EMPLOYEE, MANAGER, or OWNER")
    pin: str = Field(..., min_length=4, max_length=6)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user via Role selection + PIN or specific User ID + PIN.
    """
    user: Optional[User] = None

    if payload.user_id:
        user = db.query(User).filter(User.id == payload.user_id).first()
    elif payload.role:
        role_upper = payload.role.strip().upper()
        # Find first matching user with this role
        user = db.query(User).filter(User.role == role_upper).order_by(User.id.asc()).first()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either role or user_id must be provided with PIN."
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No account found for role '{payload.role}'. Please contact the store owner."
        )

    if not verify_pin(payload.pin, user.pin):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect 4-digit PIN. Please try again."
        )

    # Generate token
    token = create_access_token(data={
        "sub": str(user.id),
        "user_id": user.id,
        "name": user.name,
        "role": user.role
    })

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.from_orm(user)
    )


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Get profile of current logged-in user."""
    return UserOut.from_orm(current_user)


@router.get("/roles")
def get_available_roles(db: Session = Depends(get_db)):
    """
    Returns available roles and configured users to populate the PIN Login interface.
    PINs are NEVER exposed.
    """
    users = db.query(User).order_by(User.id.asc()).all()
    roles = [
        {"role": "EMPLOYEE", "label": "Employee (Counter View)", "description": "POS billing, fast checkout, print bills"},
        {"role": "MANAGER", "label": "Manager (Operations View)", "description": "Stock management, inventory replenishment, logs"},
        {"role": "OWNER", "label": "Owner (Full Access)", "description": "AI BusinessGPT, deep analytics, forecasting, settings"}
    ]
    user_list = [
        {"id": u.id, "name": u.name, "role": u.role}
        for u in users
    ]
    return {
        "roles": roles,
        "users": user_list
    }


@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER", "MANAGER"]))
):
    """List all store team members (Managers and Owners only)."""
    users = db.query(User).order_by(User.role.desc(), User.id.asc()).all()
    return [UserOut.from_orm(u) for u in users]


@router.post("/users", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER"]))
):
    """Create a new staff member with a 4-digit PIN (Owner only)."""
    role_clean = payload.role.strip().upper()
    if role_clean not in ["EMPLOYEE", "MANAGER", "OWNER"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be EMPLOYEE, MANAGER, or OWNER.")

    hashed = hash_pin(payload.pin)
    new_user = User(
        name=payload.name.strip(),
        role=role_clean,
        pin=hashed
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return UserOut.from_orm(new_user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER"]))
):
    """Remove a user account (Owner only). Cannot delete oneself."""
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own active owner account.")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    db.delete(target)
    db.commit()
    return {"message": f"User '{target.name}' ({target.role}) deleted successfully."}
