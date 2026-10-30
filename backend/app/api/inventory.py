from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.core.auth import require_role
from app.models.user import User
from app.models.product import Product
from app.models.stock_transaction import StockTransaction

router = APIRouter(prefix="/inventory", tags=["inventory"])


class AddStockRequest(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0, description="Quantity received in purchase order")
    notes: Optional[str] = "Purchase order restock"


class ProductCreateRequest(BaseModel):
    name: str = Field(..., min_length=2)
    sku: str = Field(..., min_length=2)
    category: str = Field(...)
    unit_price: float = Field(..., ge=0.0)
    current_stock: int = Field(0, ge=0)
    reorder_point: int = Field(10, ge=1)
    unit: str = Field("pcs")


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    unit_price: Optional[float] = None
    reorder_point: Optional[int] = None
    unit: Optional[str] = None


def compute_stock_status(stock: int, reorder_point: int) -> str:
    """
    Status badges: CRITICAL / LOW / OPTIMAL / OVERSTOCK
    """
    if stock <= max(1, reorder_point // 3):
        return "CRITICAL"
    elif stock <= reorder_point:
        return "LOW"
    elif stock >= (reorder_point * 6):
        return "OVERSTOCK"
    else:
        return "OPTIMAL"


@router.get("/products")
def get_inventory_products(
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["MANAGER", "OWNER"]))
):
    """Retrieve full inventory list with real-time stock levels & alert statuses."""
    query = db.query(Product)
    if category and category.strip():
        query = query.filter(Product.category == category.strip())

    products = query.order_by(Product.name.asc()).all()
    results = []

    for p in products:
        stat = compute_stock_status(p.current_stock, p.reorder_point)
        if status_filter and stat.upper() != status_filter.upper():
            continue

        results.append({
            "id": p.id,
            "name": p.name,
            "sku": p.sku,
            "category": p.category,
            "unit_price": p.unit_price,
            "current_stock": p.current_stock,
            "reorder_point": p.reorder_point,
            "unit": p.unit,
            "status": stat,
            "total_value": round(p.current_stock * p.unit_price, 2)
        })

    return results


@router.get("/summary")
def get_inventory_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["EMPLOYEE", "MANAGER", "OWNER"]))
):
    """Overall inventory metrics for dashboard & alerts."""
    products = db.query(Product).all()

    critical_count = 0
    low_count = 0
    optimal_count = 0
    overstock_count = 0
    total_val = 0.0
    critical_items = []
    low_items = []

    for p in products:
        stat = compute_stock_status(p.current_stock, p.reorder_point)
        total_val += (p.current_stock * p.unit_price)
        p_dict = {
            "id": p.id,
            "name": p.name,
            "sku": p.sku,
            "category": p.category,
            "current_stock": p.current_stock,
            "reorder_point": p.reorder_point,
            "unit": p.unit,
            "status": stat
        }
        if stat == "CRITICAL":
            critical_count += 1
            critical_items.append(p_dict)
        elif stat == "LOW":
            low_count += 1
            low_items.append(p_dict)
        elif stat == "OVERSTOCK":
            overstock_count += 1
        else:
            optimal_count += 1

    return {
        "total_products": len(products),
        "total_valuation": round(total_val, 2),
        "critical_count": critical_count,
        "low_count": low_count,
        "critical": critical_items,
        "low_stock": low_items,
        "optimal_count": optimal_count,
        "overstock_count": overstock_count
    }


@router.post("/add-stock")
def add_stock(
    payload: AddStockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["MANAGER", "OWNER"]))
):
    """
    Purchase Order / Stock Replenishment entry:
    Increments inventory and creates an immutable StockTransaction audit record.
    """
    product = db.query(Product).filter(Product.id == payload.product_id).with_for_update().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    before_st = product.current_stock
    after_st = before_st + payload.quantity
    product.current_stock = after_st

    txn = StockTransaction(
        product_id=product.id,
        type="PURCHASE",
        quantity=payload.quantity,
        before_stock=before_st,
        after_stock=after_st,
        user_id=current_user.id,
        notes=payload.notes or "Stock replenishment"
    )
    db.add(txn)
    db.commit()
    db.refresh(product)

    return {
        "message": f"Successfully added {payload.quantity} {product.unit} to '{product.name}'.",
        "product_id": product.id,
        "name": product.name,
        "previous_stock": before_st,
        "new_stock": after_st,
        "status": compute_stock_status(after_st, product.reorder_point)
    }


@router.post("/product")
def create_product(
    payload: ProductCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["MANAGER", "OWNER"]))
):
    """Add a new product to store catalog."""
    existing = db.query(Product).filter(Product.sku == payload.sku.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Product with SKU '{payload.sku}' already exists.")

    new_prod = Product(
        name=payload.name.strip(),
        sku=payload.sku.strip(),
        category=payload.category.strip(),
        unit_price=payload.unit_price,
        current_stock=payload.current_stock,
        reorder_point=payload.reorder_point,
        unit=payload.unit.strip()
    )
    db.add(new_prod)
    db.flush()

    if payload.current_stock > 0:
        db.add(StockTransaction(
            product_id=new_prod.id,
            type="PURCHASE",
            quantity=payload.current_stock,
            before_stock=0,
            after_stock=payload.current_stock,
            user_id=current_user.id,
            notes="Initial product opening stock"
        ))

    db.commit()
    db.refresh(new_prod)
    return new_prod


@router.put("/product/{product_id}")
def update_product(
    product_id: int,
    payload: ProductUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["MANAGER", "OWNER"]))
):
    """Update product details or reorder points."""
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")

    if payload.name is not None:
        prod.name = payload.name.strip()
    if payload.sku is not None:
        prod.sku = payload.sku.strip()
    if payload.category is not None:
        prod.category = payload.category.strip()
    if payload.unit_price is not None:
        prod.unit_price = payload.unit_price
    if payload.reorder_point is not None:
        prod.reorder_point = payload.reorder_point
    if payload.unit is not None:
        prod.unit = payload.unit.strip()

    db.commit()
    db.refresh(prod)
    return prod

@router.delete("/product/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["MANAGER", "OWNER"]))
):
    """Permanently delete a product from store inventory."""
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")

    p_name = prod.name
    db.query(StockTransaction).filter(StockTransaction.product_id == product_id).delete()
    db.delete(prod)
    db.commit()

    return {"message": f"Product '{p_name}' successfully deleted from catalog.", "product_id": product_id}


@router.get("/transactions")
def get_stock_transactions(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["MANAGER", "OWNER"]))
):
    """View stock transactions audit log."""
    txns = db.query(StockTransaction).order_by(desc(StockTransaction.timestamp)).limit(limit).all()
    results = []
    for t in txns:
        p = db.query(Product).filter(Product.id == t.product_id).first()
        u = db.query(User).filter(User.id == t.user_id).first() if t.user_id else None
        results.append({
            "id": t.id,
            "product_name": p.name if p else f"Product #{t.product_id}",
            "sku": p.sku if p else "-",
            "type": t.type,
            "quantity": t.quantity,
            "before_stock": t.before_stock,
            "after_stock": t.after_stock,
            "timestamp": t.timestamp,
            "user_name": u.name if u else "System",
            "notes": t.notes
        })
    return results


# ─── Conversational Natural Language Inventory Adjustment Endpoints ───

class NaturalAdjustRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Spoken or typed natural language update")
    session_id: Optional[str] = None
    store_id: Optional[int] = 1
    source: Optional[str] = "inventory_ui"


class ConfirmAdjustRequest(BaseModel):
    session_id: Optional[str] = None
    pending_id: Optional[int] = None


class CancelAdjustRequest(BaseModel):
    session_id: Optional[str] = None
    pending_id: Optional[int] = None


@router.post("/natural-adjust")
def natural_inventory_adjustment(
    payload: NaturalAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["EMPLOYEE", "MANAGER", "OWNER"]))
):
    """
    Parses conversational stock updates in Hindi, Hinglish, Marathi, or English.
    Returns structured preview summary requiring mandatory confirmation.
    """
    from app.modules.inventory.conversational import handle_conversational_inventory

    session_id = payload.session_id or f"user_{current_user.id}"
    store_id = payload.store_id or getattr(current_user, "store_id", 1) or 1

    result = handle_conversational_inventory(
        query=payload.message,
        session_id=session_id,
        user=current_user,
        store_id=store_id,
        db=db,
        source=payload.source or "inventory_ui"
    )
    return result


@router.post("/natural-adjust/confirm")
def confirm_natural_inventory_adjustment(
    payload: ConfirmAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["EMPLOYEE", "MANAGER", "OWNER"]))
):
    """
    Executes a previously staged natural language inventory adjustment atomically.
    Guarantees idempotency and updates stock transactions audit ledger.
    """
    from app.models.inventory_adjustment import PendingInventoryAdjustment
    from app.modules.inventory.conversational import execute_confirmed_adjustment

    query = db.query(PendingInventoryAdjustment).filter(PendingInventoryAdjustment.status == "PENDING")
    if payload.pending_id:
        pending = query.filter(PendingInventoryAdjustment.id == payload.pending_id).first()
    elif payload.session_id:
        pending = query.filter(PendingInventoryAdjustment.session_id == payload.session_id).order_by(desc(PendingInventoryAdjustment.created_at)).first()
    else:
        pending = query.filter(PendingInventoryAdjustment.session_id == f"user_{current_user.id}").order_by(desc(PendingInventoryAdjustment.created_at)).first()

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Koi pending stock update nahi mila ya yeh pehle hi confirm ho chuka hai."
        )

    result = execute_confirmed_adjustment(db, pending, current_user.id)
    return result


@router.post("/natural-adjust/cancel")
def cancel_natural_inventory_adjustment(
    payload: CancelAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["EMPLOYEE", "MANAGER", "OWNER"]))
):
    """
    Cancels a pending staged inventory adjustment without mutating stock.
    """
    from app.models.inventory_adjustment import PendingInventoryAdjustment

    query = db.query(PendingInventoryAdjustment).filter(PendingInventoryAdjustment.status == "PENDING")
    if payload.pending_id:
        pending = query.filter(PendingInventoryAdjustment.id == payload.pending_id).first()
    elif payload.session_id:
        pending = query.filter(PendingInventoryAdjustment.session_id == payload.session_id).order_by(desc(PendingInventoryAdjustment.created_at)).first()
    else:
        pending = query.filter(PendingInventoryAdjustment.session_id == f"user_{current_user.id}").order_by(desc(PendingInventoryAdjustment.created_at)).first()

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Koi pending stock update nahi mila."
        )

    pending.status = "CANCELLED"
    db.commit()
    return {
        "status": "CANCELLED",
        "response": "Stock update cancel kar diya gaya hai. Store inventory mein koi badlaav nahi hua."
    }


@router.get("/natural-adjust/pending")
def get_pending_natural_adjustment(
    session_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["EMPLOYEE", "MANAGER", "OWNER"]))
):
    """
    Checks if there is an active pending stock adjustment waiting for confirmation.
    """
    from app.models.inventory_adjustment import PendingInventoryAdjustment
    import json

    target_session = session_id or f"user_{current_user.id}"
    pending = db.query(PendingInventoryAdjustment).filter(
        PendingInventoryAdjustment.session_id == target_session,
        PendingInventoryAdjustment.status == "PENDING"
    ).order_by(desc(PendingInventoryAdjustment.created_at)).first()

    if not pending:
        return {"has_pending": False, "pending": None}

    return {
        "has_pending": True,
        "pending": {
            "id": pending.id,
            "session_id": pending.session_id,
            "summary_text": pending.summary_text,
            "movements": json.loads(pending.movements_json),
            "created_at": pending.created_at.isoformat() if pending.created_at else None,
            "status": pending.status
        }
    }
