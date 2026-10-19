from pydantic import BaseModel
from datetime import datetime
from typing import List, Any, Dict, Optional

class DatasetBase(BaseModel):
    filename: str

class DatasetCreate(DatasetBase):
    row_count: int
    columns: List[str]
    data: List[Dict[str, Any]]

class DatasetResponse(DatasetBase):
    id: int
    upload_date: datetime
    row_count: int
    columns: List[str]
    dataset_type: Optional[str] = "unknown"
    table_name: Optional[str] = None

    class Config:
        from_attributes = True
