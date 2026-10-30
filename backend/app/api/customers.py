import re
import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from app.core.database import get_db
from app.core.auth import get_current_user, require_role
from app.models.user import User
from app.models.customer import Customer, CustomerSetting
from app.models.bill import Bill

logger = logging.getLogger("businessgpt.customers")

router = APIRouter(prefix="/customers", tags=["customers"])

VALID_FIELD_KEYS = {
    "full_name",
    "phone",
    "email",
    "billing_address",
    "date_of_birth",
    "notes"
}

FIELD_LABELS = {
    "full_name": "Full Name",
    "phone": "Phone Number",
    "email": "Email Address",
    "billing_address": "Billing Address",
    "date_of_birth": "Date of Birth",
    "notes": "Customer Notes"
}


# ── Phone and Email Normalization & Validation ──
def is_valid_phone_number(raw: Optional[str]) -> bool:
    if not raw or not str(raw).strip():
        return False
    cleaned_str = str(raw).strip()
    # Reject strings containing letters or special characters other than +, -, space, brackets
    if re.search(r"[a-zA-Z]", cleaned_str):
        return False
    digits = re.sub(r"[^\d]", "", cleaned_str)
    # Valid mobile numbers must have between 10 and 15 digits
    return 10 <= len(digits) <= 15


def normalize_phone_number(raw: Optional[str]) -> Optional[str]:
    if not raw or not str(raw).strip():
        return None
    cleaned_str = str(raw).strip()
    if not is_valid_phone_number(cleaned_str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid mobile number. Please provide a valid 10-digit mobile number."
        )
    cleaned = re.sub(r"[^\d+]", "", cleaned_str)
    # If 10-digit Indian number without country code e.g. 9876543210
    if len(cleaned) == 10 and not cleaned.startswith("+"):
        return f"+91{cleaned}"
    if len(cleaned) == 11 and cleaned.startswith("0"):
        return f"+91{cleaned[1:]}"
    if not cleaned.startswith("+") and len(cleaned) >= 10:
        return f"+{cleaned}"
    return cleaned


def normalize_email_address(raw: Optional[str]) -> Optional[str]:
    if not raw or not str(raw).strip():
        return None
    email_clean = str(raw).strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email_clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format. Please provide a valid email address."
        )
    return email_clean


def get_or_create_settings(db: Session, store_id: int) -> CustomerSetting:
    setting = db.query(CustomerSetting).filter(CustomerSetting.store_id == store_id).first()
    if not setting:
        setting = CustomerSetting(
            store_id=store_id,
            enabled=False,
            allow_walk_in=True,
            customer_selection_optional=True,
            save_purchase_history=False,
            require_consent=False,
            enabled_fields='["full_name", "phone"]',
            required_fields='[]'
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


# ── Schemas ──
class CustomerSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    allow_walk_in: Optional[bool] = None
    customer_selection_optional: Optional[bool] = None
    save_purchase_history: Optional[bool] = None
    require_consent: Optional[bool] = None
    enabled_fields: Optional[List[str]] = None
    required_fields: Optional[List[str]] = None


class CustomerSettingsOut(BaseModel):
    store_id: int
    enabled: bool
    allow_walk_in: bool
    customer_selection_optional: bool
    save_purchase_history: bool
    require_consent: bool
    enabled_fields: List[str]
    required_fields: List[str]
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CustomerCreate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    billing_address: Optional[str] = None
    date_of_birth: Optional[str] = None
    notes: Optional[str] = None
    consent_given: bool = False


class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    billing_address: Optional[str] = None
    date_of_birth: Optional[str] = None
    notes: Optional[str] = None
    consent_given: Optional[bool] = None


class CustomerOut(BaseModel):
    id: int
    store_id: int
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    billing_address: Optional[str] = None
    date_of_birth: Optional[str] = None
    notes: Optional[str] = None
    consent_given: bool
    consent_timestamp: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PurchaseRecordOut(BaseModel):
    id: int
    bill_number: str
    date: datetime
    total: float
    payment_method: str
    items_count: int


class CustomerDetailOut(CustomerOut):
    total_spent: float = 0.0
    purchase_count: int = 0
    purchase_history: List[PurchaseRecordOut] = []


# ── Settings Endpoints ──
@router.get("/settings", response_model=CustomerSettingsOut)
def get_customer_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve customer collection & CRM configuration for the authenticated store."""
    store_id = getattr(current_user, "store_id", 1) or 1
    setting = get_or_create_settings(db, store_id)
    return CustomerSettingsOut(
        store_id=setting.store_id,
        enabled=setting.enabled,
        allow_walk_in=setting.allow_walk_in,
        customer_selection_optional=setting.customer_selection_optional,
        save_purchase_history=setting.save_purchase_history,
        require_consent=setting.require_consent,
        enabled_fields=setting.enabled_fields_list,
        required_fields=setting.required_fields_list,
        updated_at=setting.updated_at
    )


@router.put("/settings", response_model=CustomerSettingsOut)
def update_customer_settings(
    payload: CustomerSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER", "MANAGER"]))
):
    """Update customer collection settings (Owner and Manager)."""
    store_id = getattr(current_user, "store_id", 1) or 1
    setting = get_or_create_settings(db, store_id)

    if payload.enabled is not None:
        setting.enabled = payload.enabled
    if payload.allow_walk_in is not None:
        setting.allow_walk_in = payload.allow_walk_in
    if payload.customer_selection_optional is not None:
        setting.customer_selection_optional = payload.customer_selection_optional
    if payload.save_purchase_history is not None:
        setting.save_purchase_history = payload.save_purchase_history
    if payload.require_consent is not None:
        setting.require_consent = payload.require_consent

    # Validate and update enabled fields
    current_enabled = set(setting.enabled_fields_list)
    if payload.enabled_fields is not None:
        for f in payload.enabled_fields:
            if f not in VALID_FIELD_KEYS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid field '{f}'. Allowed fields: {', '.join(sorted(VALID_FIELD_KEYS))}"
                )
        current_enabled = set(payload.enabled_fields)
        setting.enabled_fields = json.dumps(list(current_enabled))

    # Validate and update required fields
    if payload.required_fields is not None:
        for f in payload.required_fields:
            if f not in VALID_FIELD_KEYS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid required field '{f}'."
                )
            if f not in current_enabled:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Field '{FIELD_LABELS.get(f, f)}' cannot be required because it is not enabled in POS checkout."
                )
        setting.required_fields = json.dumps(list(set(payload.required_fields)))

    db.commit()
    db.refresh(setting)

    return CustomerSettingsOut(
        store_id=setting.store_id,
        enabled=setting.enabled,
        allow_walk_in=setting.allow_walk_in,
        customer_selection_optional=setting.customer_selection_optional,
        save_purchase_history=setting.save_purchase_history,
        require_consent=setting.require_consent,
        enabled_fields=setting.enabled_fields_list,
        required_fields=setting.required_fields_list,
        updated_at=setting.updated_at
    )


# ── Customer Data Endpoints ──
@router.get("", response_model=List[CustomerOut])
def list_customers(
    q: Optional[str] = Query(None, description="Search by name, phone, or email"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all customers scoped to the authenticated store with optional filter."""
    store_id = getattr(current_user, "store_id", 1) or 1
    query = db.query(Customer).filter(Customer.store_id == store_id)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Customer.full_name.ilike(term),
                Customer.phone.ilike(term),
                Customer.email.ilike(term)
            )
        )

    return query.order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/search", response_model=List[CustomerOut])
def search_customers(
    q: str = Query(..., min_length=1, description="Search by name or phone"),
    limit: int = 15,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Quick search customers by name or phone for POS counter lookup."""
    store_id = getattr(current_user, "store_id", 1) or 1
    term = f"%{q.strip()}%"
    customers = db.query(Customer).filter(
        Customer.store_id == store_id,
        or_(
            Customer.full_name.ilike(term),
            Customer.phone.ilike(term),
            Customer.email.ilike(term)
        )
    ).order_by(Customer.full_name.asc()).limit(limit).all()
    return customers


@router.post("", response_model=CustomerOut)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new customer record scoped to the authenticated store."""
    store_id = getattr(current_user, "store_id", 1) or 1
    settings = get_or_create_settings(db, store_id)

    # 1. Consent Verification
    if settings.require_consent and not payload.consent_given:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer consent is required before saving details as per store settings."
        )

    # 2. Field Normalization & Phone Validation
    phone_norm = normalize_phone_number(payload.phone) if payload.phone else None
    email_norm = normalize_email_address(payload.email) if payload.email else None
    name_norm = payload.full_name.strip() if payload.full_name else None

    # 3. Enabled Fields Filtering: Never collect non-enabled fields
    enabled_set = set(settings.enabled_fields_list)
    address_val = payload.billing_address.strip() if (payload.billing_address and "billing_address" in enabled_set) else None
    dob_val = payload.date_of_birth.strip() if (payload.date_of_birth and "date_of_birth" in enabled_set) else None
    notes_val = payload.notes.strip() if (payload.notes and "notes" in enabled_set) else None
    if "full_name" not in enabled_set:
        name_norm = None
    if "phone" not in enabled_set:
        phone_norm = None
    if "email" not in enabled_set:
        email_norm = None

    # 4. Mandatory Fields Validation
    required_set = set(settings.required_fields_list)
    field_values = {
        "full_name": name_norm,
        "phone": phone_norm,
        "email": email_norm,
        "billing_address": address_val,
        "date_of_birth": dob_val,
        "notes": notes_val
    }
    for req_field in required_set:
        if not field_values.get(req_field):
            label = FIELD_LABELS.get(req_field, req_field)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Field '{label}' is required by store policy."
            )

    # 5. Duplicate Phone Number Check within same store
    if phone_norm:
        existing = db.query(Customer).filter(
            Customer.store_id == store_id,
            Customer.phone == phone_norm
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A customer with phone number {phone_norm} already exists in this store (Name: {existing.full_name or 'Unnamed'})."
            )

    now_utc = datetime.now(timezone.utc)
    new_customer = Customer(
        store_id=store_id,
        full_name=name_norm,
        phone=phone_norm,
        email=email_norm,
        billing_address=address_val,
        date_of_birth=dob_val,
        notes=notes_val,
        consent_given=payload.consent_given,
        consent_timestamp=now_utc if payload.consent_given else None
    )

    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer


@router.get("/{customer_id}", response_model=CustomerDetailOut)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve customer details and purchase history scoped to the store."""
    store_id = getattr(current_user, "store_id", 1) or 1
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.store_id == store_id
    ).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found or unauthorized access."
        )

    settings = get_or_create_settings(db, store_id)
    purchase_history = []
    total_spent = 0.0
    purchase_count = 0

    # Calculate actual purchase history if enabled
    if settings.save_purchase_history:
        bills = db.query(Bill).filter(
            Bill.customer_id == customer.id,
            Bill.status == "COMPLETED"
        ).order_by(Bill.created_at.desc()).all()

        for b in bills:
            purchase_history.append(PurchaseRecordOut(
                id=b.id,
                bill_number=b.bill_number,
                date=b.created_at,
                total=round(b.total_amount, 2),
                payment_method=b.payment_method,
                items_count=len(b.items)
            ))
            total_spent += b.total_amount
            purchase_count += 1

    return CustomerDetailOut(
        id=customer.id,
        store_id=customer.store_id,
        full_name=customer.full_name,
        phone=customer.phone,
        email=customer.email,
        billing_address=customer.billing_address,
        date_of_birth=customer.date_of_birth,
        notes=customer.notes,
        consent_given=customer.consent_given,
        consent_timestamp=customer.consent_timestamp,
        created_at=customer.created_at,
        updated_at=customer.updated_at,
        total_spent=round(total_spent, 2),
        purchase_count=purchase_count,
        purchase_history=purchase_history
    )


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update customer details scoped to authenticated store."""
    store_id = getattr(current_user, "store_id", 1) or 1
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.store_id == store_id
    ).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found or unauthorized access."
        )

    settings = get_or_create_settings(db, store_id)
    enabled_set = set(settings.enabled_fields_list)

    if payload.full_name is not None and "full_name" in enabled_set:
        customer.full_name = payload.full_name.strip()
    if payload.phone is not None and "phone" in enabled_set:
        if payload.phone.strip():
            norm_phone = normalize_phone_number(payload.phone)
            # Check duplicate if changed
            if norm_phone and norm_phone != customer.phone:
                dup = db.query(Customer).filter(
                    Customer.store_id == store_id,
                    Customer.phone == norm_phone,
                    Customer.id != customer.id
                ).first()
                if dup:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Phone number {norm_phone} is already linked to another customer."
                    )
            customer.phone = norm_phone
        else:
            customer.phone = None
    if payload.email is not None and "email" in enabled_set:
        customer.email = normalize_email_address(payload.email) if payload.email else None
    if payload.billing_address is not None and "billing_address" in enabled_set:
        customer.billing_address = payload.billing_address.strip()
    if payload.date_of_birth is not None and "date_of_birth" in enabled_set:
        customer.date_of_birth = payload.date_of_birth.strip()
    if payload.notes is not None and "notes" in enabled_set:
        customer.notes = payload.notes.strip()
    if payload.consent_given is not None:
        customer.consent_given = payload.consent_given
        if payload.consent_given:
            customer.consent_timestamp = datetime.now(timezone.utc)

    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["OWNER", "MANAGER"]))
):
    """
    Delete customer profile and unlink transactions (Right to Erasure / DPDP).
    Financial bill records are preserved with customer_id=NULL.
    """
    store_id = getattr(current_user, "store_id", 1) or 1
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.store_id == store_id
    ).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found or unauthorized access."
        )

    # Unlink bills to preserve financial audit trail without retaining customer PII
    db.query(Bill).filter(Bill.customer_id == customer.id).update({Bill.customer_id: None})
    db.delete(customer)
    db.commit()

    return {"message": "Customer record deleted and bills unlinked successfully in compliance with privacy obligations."}
