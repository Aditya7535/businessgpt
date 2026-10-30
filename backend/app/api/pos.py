from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.core.database import get_db
from app.core.auth import get_current_user, require_role
from app.models.user import User
from app.models.product import Product
from app.models.stock_transaction import StockTransaction
from app.models.bill import Bill, BillItem
from app.models.sales_data import SalesData
from app.models.alert import Alert
from app.models.customer import Customer, CustomerSetting
from app.api.customers import normalize_phone_number, normalize_email_address, is_valid_phone_number, FIELD_LABELS

router = APIRouter(prefix="/pos", tags=["pos"])


class BillItemInput(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    unit_price: float = Field(..., ge=0.0)


class CreateBillRequest(BaseModel):
    items: List[BillItemInput]
    payment_method: str = Field(..., description="Cash, UPI, or Card")
    tax_rate: float = Field(0.0, description="GST rate (e.g. 0.05, 0.12, 0.18)")
    notes: Optional[str] = None
    customer_id: Optional[int] = None
    customer_data: Optional[Dict[str, Any]] = None


class BillItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    subtotal: float


class BillOut(BaseModel):
    id: int
    bill_number: str
    total_amount: float
    tax_amount: float
    payment_method: str
    status: str
    created_at: datetime
    employee_name: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    items: List[BillItemOut]


@router.get("/products")
def search_products(
    q: Optional[str] = Query(None, description="Search by name, SKU, or category"),
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Search products for POS quick-add grid."""
    query = db.query(Product)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(term),
                Product.sku.ilike(term),
                Product.category.ilike(term)
            )
        )
    if category and category.strip():
        query = query.filter(Product.category == category.strip())

    products = query.order_by(Product.name.asc()).all()

    return [
        {
            "id": p.id,
            "name": p.name,
            "sku": p.sku,
            "category": p.category,
            "unit_price": p.unit_price,
            "current_stock": p.current_stock,
            "reorder_point": p.reorder_point,
            "unit": p.unit,
            "is_low_stock": p.current_stock <= p.reorder_point,
            "is_critical": p.current_stock <= max(1, p.reorder_point // 3)
        }
        for p in products
    ]


@router.post("/bill", response_model=BillOut)
def create_bill(
    payload: CreateBillRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate Bill at POS counter with strict validation:
    1. Validates customer information according to store CRM settings (BEFORE inventory updates)
    2. Validates stock availability
    3. Calculates subtotals + GST
    4. Generates Bill and BillItems
    5. Deducts stock & creates stock_transactions audit log
    6. Updates daily pre-aggregated sales_data
    7. Triggers stock alert if reorder threshold breached
    8. Commits transaction atomically
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="Bill must contain at least one item.")

    store_id = getattr(current_user, "store_id", 1) or 1
    cust_settings = db.query(CustomerSetting).filter(CustomerSetting.store_id == store_id).first()

    resolved_customer: Optional[Customer] = None

    # ── STEP 1: Strict Customer Information Validation (Before any DB mutations) ──
    if cust_settings and cust_settings.enabled:
        enabled_fields = set(cust_settings.enabled_fields_list)
        required_fields = set(cust_settings.required_fields_list)

        if payload.customer_id:
            # 1A. Existing customer selected: verify existence in store
            resolved_customer = db.query(Customer).filter(
                Customer.id == payload.customer_id,
                Customer.store_id == store_id
            ).first()
            if not resolved_customer:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Selected customer not found in this store."
                )

            # Verify that the selected customer satisfies all required fields
            for req in required_fields:
                val = getattr(resolved_customer, req, None)
                if not val or not str(val).strip():
                    label = FIELD_LABELS.get(req, req)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Selected customer '{resolved_customer.full_name or 'Customer'}' is missing required field '{label}'. Please update customer details before generating bill."
                    )

            # If phone is present on customer, verify it is valid
            if resolved_customer.phone and not is_valid_phone_number(resolved_customer.phone):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid phone number for selected customer. Please update customer details."
                )

        elif payload.customer_data:
            # 1B. New customer details provided
            c_data = payload.customer_data
            consent_val = bool(c_data.get("consent_given", False))

            if cust_settings.require_consent and not consent_val:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Customer consent is required before saving details as per store settings."
                )

            raw_phone = c_data.get("phone")
            phone_norm = None
            if raw_phone and str(raw_phone).strip():
                if not is_valid_phone_number(raw_phone):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid phone number. Please enter a valid 10-digit mobile number."
                    )
                if "phone" in enabled_fields:
                    phone_norm = normalize_phone_number(raw_phone)

            raw_email = c_data.get("email")
            email_norm = normalize_email_address(raw_email) if (raw_email and "email" in enabled_fields) else None

            raw_name = c_data.get("full_name")
            name_norm = raw_name.strip() if (raw_name and "full_name" in enabled_fields) else None

            address_val = c_data.get("billing_address", "").strip() if ("billing_address" in enabled_fields and c_data.get("billing_address")) else None
            dob_val = c_data.get("date_of_birth", "").strip() if ("date_of_birth" in enabled_fields and c_data.get("date_of_birth")) else None
            notes_val = c_data.get("notes", "").strip() if ("notes" in enabled_fields and c_data.get("notes")) else None

            # Validate each mandatory field
            field_map = {
                "full_name": name_norm,
                "phone": phone_norm,
                "email": email_norm,
                "billing_address": address_val,
                "date_of_birth": dob_val,
                "notes": notes_val
            }
            for req in required_fields:
                if not field_map.get(req):
                    label = FIELD_LABELS.get(req, req)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Customer detail '{label}' is required by store policy."
                    )

            # Check if customer with same phone already exists in store
            if phone_norm:
                resolved_customer = db.query(Customer).filter(
                    Customer.store_id == store_id,
                    Customer.phone == phone_norm
                ).first()

            if not resolved_customer:
                now_utc = datetime.now(timezone.utc)
                resolved_customer = Customer(
                    store_id=store_id,
                    full_name=name_norm,
                    phone=phone_norm,
                    email=email_norm,
                    billing_address=address_val,
                    date_of_birth=dob_val,
                    notes=notes_val,
                    consent_given=consent_val,
                    consent_timestamp=now_utc if consent_val else None
                )
                db.add(resolved_customer)
                db.flush()
        else:
            # 1C. Neither customer_id nor customer_data provided (Walk-in attempted)
            # If any required fields are configured by store owner, walk-in CANNOT bypass them!
            if required_fields:
                req_names = ", ".join(FIELD_LABELS.get(r, r) for r in required_fields)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Customer details are mandatory before generating bill ({req_names}). Walk-in checkout is not permitted when required fields are configured."
                )

            # If walk-in is explicitly disabled
            if not cust_settings.allow_walk_in or not cust_settings.customer_selection_optional:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Walk-in billing is disabled by store policy. Customer details must be provided."
                )
    else:
        # Collection disabled: if customer_id provided, look up for receipt display
        if payload.customer_id:
            resolved_customer = db.query(Customer).filter(
                Customer.id == payload.customer_id,
                Customer.store_id == store_id
            ).first()

    # ── STEP 2: Product & Stock Validation (Atomic Lock) ──
    subtotal_sum = 0.0
    items_to_create = []
    stock_updates = []

    for item_input in payload.items:
        product = db.query(Product).filter(Product.id == item_input.product_id).with_for_update().first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product with ID {item_input.product_id} not found.")

        if product.current_stock < item_input.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{product.name}'. Available: {product.current_stock}, Requested: {item_input.quantity}"
            )

        item_subtotal = round(item_input.quantity * item_input.unit_price, 2)
        subtotal_sum += item_subtotal

        before_st = product.current_stock
        after_st = before_st - item_input.quantity
        product.current_stock = after_st

        stock_updates.append((product, item_input.quantity, before_st, after_st, item_input.unit_price))

        items_to_create.append({
            "product": product,
            "quantity": item_input.quantity,
            "unit_price": item_input.unit_price,
            "subtotal": item_subtotal
        })

    # ── STEP 3: Financial Calculations & Bill Generation ──
    tax_amount = round(subtotal_sum * payload.tax_rate, 2)
    total_amount = round(subtotal_sum + tax_amount, 2)

    # Collision-free sequential bill number
    current_year = datetime.now().year
    max_id = db.query(func.max(Bill.id)).scalar() or 0
    bill_number = f"BGT-{current_year}-{str(max_id + 1).zfill(4)}"

    # Link customer_id only if save_purchase_history is enabled in CRM settings
    should_link_history = bool(
        resolved_customer and cust_settings and cust_settings.enabled and cust_settings.save_purchase_history
    )
    linked_customer_id = resolved_customer.id if (resolved_customer and should_link_history) else None

    new_bill = Bill(
        bill_number=bill_number,
        employee_id=current_user.id,
        customer_id=linked_customer_id,
        total_amount=total_amount,
        tax_amount=tax_amount,
        payment_method=payload.payment_method,
        status="COMPLETED"
    )
    db.add(new_bill)
    db.flush()

    # ── STEP 4: Inventory Deduction & Stock Transactions ──
    out_items = []
    today = date.today()

    for item_data in items_to_create:
        prod = item_data["product"]
        b_item = BillItem(
            bill_id=new_bill.id,
            product_id=prod.id,
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"],
            subtotal=item_data["subtotal"]
        )
        db.add(b_item)
        db.flush()

        out_items.append(BillItemOut(
            id=b_item.id,
            product_id=prod.id,
            product_name=prod.name,
            quantity=b_item.quantity,
            unit_price=b_item.unit_price,
            subtotal=b_item.subtotal
        ))

        # Stock Transaction Log
        db.add(StockTransaction(
            product_id=prod.id,
            type="SALE",
            quantity=-item_data["quantity"],
            before_stock=prod.current_stock + item_data["quantity"],
            after_stock=prod.current_stock,
            user_id=current_user.id,
            bill_id=new_bill.id,
            notes=f"POS Sale: Bill {bill_number}"
        ))

        # Update Daily Pre-aggregated sales_data
        daily_record = db.query(SalesData).filter(
            SalesData.product_id == prod.id,
            SalesData.date == today
        ).first()

        cost_est = round(item_data["subtotal"] * 0.78, 2)
        if daily_record:
            daily_record.quantity_sold += item_data["quantity"]
            daily_record.revenue = round(daily_record.revenue + item_data["subtotal"], 2)
            daily_record.cost = round(daily_record.cost + cost_est, 2)
        else:
            db.add(SalesData(
                product_id=prod.id,
                date=today,
                quantity_sold=item_data["quantity"],
                revenue=item_data["subtotal"],
                cost=cost_est
            ))

        # Check for low or critical stock alerts
        if prod.current_stock <= prod.reorder_point:
            severity = "HIGH" if prod.current_stock <= max(1, prod.reorder_point // 3) else "MEDIUM"
            db.add(Alert(
                alert_type="INVENTORY",
                severity=severity,
                message=f"Stock Alert: {prod.name} has reached {prod.current_stock} {prod.unit} (Reorder point: {prod.reorder_point}).",
                is_read=False
            ))

    db.commit()
    db.refresh(new_bill)

    # Return customer info for printing/UI without sensitive internal data (DOB, internal notes)
    c_name = resolved_customer.full_name if resolved_customer else None
    c_phone = resolved_customer.phone if resolved_customer else None
    c_email = resolved_customer.email if resolved_customer else None
    c_address = resolved_customer.billing_address if resolved_customer else None

    return BillOut(
        id=new_bill.id,
        bill_number=new_bill.bill_number,
        total_amount=new_bill.total_amount,
        tax_amount=new_bill.tax_amount,
        payment_method=new_bill.payment_method,
        status=new_bill.status,
        created_at=new_bill.created_at,
        employee_name=current_user.name,
        customer_id=resolved_customer.id if resolved_customer else None,
        customer_name=c_name,
        customer_phone=c_phone,
        customer_email=c_email,
        customer_address=c_address,
        items=out_items
    )


@router.get("/bills")
def get_bills_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve bill history for POS counter and audit."""
    bills = db.query(Bill).order_by(Bill.created_at.desc()).limit(limit).all()

    result = []
    for b in bills:
        emp = db.query(User).filter(User.id == b.employee_id).first() if b.employee_id else None
        cust = db.query(Customer).filter(Customer.id == b.customer_id).first() if b.customer_id else None
        item_list = []
        for it in b.items:
            prod = db.query(Product).filter(Product.id == it.product_id).first()
            item_list.append({
                "id": it.id,
                "product_id": it.product_id,
                "product_name": prod.name if prod else "Unknown",
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "subtotal": it.subtotal
            })

        result.append({
            "id": b.id,
            "bill_number": b.bill_number,
            "total_amount": b.total_amount,
            "tax_amount": b.tax_amount,
            "payment_method": b.payment_method,
            "status": b.status,
            "created_at": b.created_at,
            "employee_name": emp.name if emp else "Counter Staff",
            "customer_id": b.customer_id,
            "customer_name": cust.full_name if cust else None,
            "customer_phone": cust.phone if cust else None,
            "items": item_list
        })

    return result
