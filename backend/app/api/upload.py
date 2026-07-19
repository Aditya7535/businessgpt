from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.dataset import Dataset
from app.schemas.dataset import DatasetResponse
from app.services.data_cleaning import clean_dataset
from app.modules.rag.embeddings import embed_dataset

router = APIRouter()

@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db)):
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
    
    # Save metadata and JSON data to PostgreSQL
    new_dataset = Dataset(
        filename=file.filename,
        row_count=row_count,
        columns=columns,
        data=data
    )
    
    db.add(new_dataset)
    db.commit()
    db.refresh(new_dataset)
    
    # Step 5: Automatically trigger embedding pipeline
    background_tasks.add_task(embed_dataset, data, file.filename)
    
    return new_dataset
