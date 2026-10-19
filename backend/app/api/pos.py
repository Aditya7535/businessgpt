from typing import List, Optional
from datetime import datetime, date
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
    Generate Bill at POS counter:
    1. Validates stock
    2. Deducts stock & creates stock_transactions audit log
    3. Calculates subtotals + GST
    4. Saves Bill and BillItems
    5. Updates daily pre-aggregated sales_data
    6. Triggers stock alert if reorder threshold breached
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="Bill must contain at least one item.")

    # Generate collision-free sequential Bill Number: BGT-YYYY-XXXX
    current_year = datetime.now().year
    max_id = db.query(func.max(Bill.id)).scalar() or 0
    bill_number = f"BGT-{current_year}-{str(max_id + 1).zfill(4)}"

    subtotal_sum = 0.0
    items_to_create = []
    stock_updates = []

    # Validate items and calculate subtotal
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

        # Prepare stock deduction record
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

    tax_amount = round(subtotal_sum * payload.tax_rate, 2)
    total_amount = round(subtotal_sum + tax_amount, 2)

    new_bill = Bill(
        bill_number=bill_number,
        employee_id=current_user.id,
        total_amount=total_amount,
        tax_amount=tax_amount,
        payment_method=payload.payment_method,
        status="COMPLETED"
    )
    db.add(new_bill)
    db.flush()  # Populates new_bill.id

    # Create BillItems and StockTransactions
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

    return BillOut(
        id=new_bill.id,
        bill_number=new_bill.bill_number,
        total_amount=new_bill.total_amount,
        tax_amount=new_bill.tax_amount,
        payment_method=new_bill.payment_method,
        status=new_bill.status,
        created_at=new_bill.created_at,
        employee_name=current_user.name,
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
            "items": item_list
        })

    return result
