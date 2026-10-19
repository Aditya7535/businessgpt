from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from app.core.auth import require_role
from app.models.user import User
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.dataset import Dataset
from app.schemas.dataset import DatasetResponse
from app.services.data_cleaning import clean_dataset
from app.services.dataset_table import create_uploaded_table

import logging
logger = logging.getLogger("businessgpt.upload")

router = APIRouter()

SALES_KEYWORDS     = {"sales", "revenue", "amount", "profit", "income", "net_sales", "sale_price"}
INVENTORY_KEYWORDS = {"stock", "inventory", "quantity", "stock_quantity", "on_hand", "qty"}
GENERAL_KEYWORDS   = {"product", "category", "price", "item", "sku", "brand", "description"}

def detect_dataset_type(columns: list[str]) -> str:
    """Infer dataset type from column names.
    Priority: sales > inventory > general > unknown
    """
    lower_cols = {c.lower() for c in columns}
    if lower_cols & SALES_KEYWORDS:
        return "sales"
    if lower_cols & INVENTORY_KEYWORDS:
        return "inventory"
    if lower_cols & GENERAL_KEYWORDS:
        return "general"
    return "unknown"

@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(require_role(["MANAGER", "OWNER"]))):
    content = await file.read()
    
    try:
        cleaned_data = clean_dataset(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
    
    if not cleaned_data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty or could not be processed.")

    # Extract data for database storage
    row_count = len(cleaned_data)
    columns = list(cleaned_data[0].keys()) if row_count > 0 else []
    data = cleaned_data
    
    # Auto-detect dataset type from column names
    dataset_type = detect_dataset_type(columns)

    # Save metadata and JSON data to PostgreSQL
    new_dataset = Dataset(
        filename=file.filename,
        row_count=row_count,
        columns=columns,
        data=data,
        dataset_type=dataset_type
    )
    
    db.add(new_dataset)
    db.commit()
    db.refresh(new_dataset)
    
    # Create persistent PostgreSQL table for Text-to-SQL
    try:
        table_name = create_uploaded_table(new_dataset.id, file.filename, data, db=db)
        new_dataset.table_name = table_name
        db.commit()
        db.refresh(new_dataset)
    except Exception as e:
        logger.error(f"Failed to create uploaded PostgreSQL table for dataset {new_dataset.id}: {e}")

    return new_dataset

