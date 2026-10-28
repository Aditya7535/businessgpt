import re
import logging
from typing import List, Dict, Any, Optional
import pandas as pd
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import engine, SessionLocal
from app.models.dataset import Dataset

logger = logging.getLogger("businessgpt.dataset_table")


def sanitize_identifier(name: str) -> str:
    """Sanitize any string into a valid PostgreSQL identifier."""
    if not name:
        return "col"
    s = re.sub(r'[^a-zA-Z0-9_]+', '_', str(name).strip()).lower().strip('_')
    if not s:
        return "col"
    if s[0].isdigit():
        s = f"col_{s}"
    return s[:55]


def create_uploaded_table(
    dataset_id: int,
    filename: str,
    data: List[Dict[str, Any]],
    db: Optional[Session] = None
) -> str:
    """
    Creates a PostgreSQL table `uploaded_{dataset_id}_{sanitized_filename}`
    and populates it with all rows from the uploaded dataset.
    """
    if not data:
        raise ValueError("Cannot create table from empty dataset.")

    base_name = filename.rsplit('.', 1)[0] if '.' in filename else filename
    sanitized_fname = sanitize_identifier(base_name)
    table_name = f"uploaded_{dataset_id}_{sanitized_fname}"[:63]

    df = pd.DataFrame(data)

    # Sanitize and deduplicate column names
    seen = set()
    cleaned_columns = []
    for col in df.columns:
        s = sanitize_identifier(str(col))
        base = s
        counter = 1
        while s in seen or not s:
            s = f"{base}_{counter}"
            counter += 1
        seen.add(s)
        cleaned_columns.append(s)

    df.columns = cleaned_columns

    # Write to database
    try:
        df.to_sql(name=table_name, con=engine, if_exists="replace", index=False)
        logger.info(f"Successfully created table '{table_name}' with {len(df)} rows and columns: {cleaned_columns}")
    except Exception as e:
        logger.error(f"Failed to create table '{table_name}': {e}", exc_info=True)
        raise

    # Update Dataset record in DB if available
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if dataset:
            dataset.table_name = table_name
            dataset.columns = cleaned_columns
            db.commit()
    except Exception as e:
        logger.warning(f"Failed to update dataset table_name in DB: {e}")
        db.rollback()
    finally:
        if should_close:
            db.close()

    return table_name


def get_all_uploaded_tables_metadata(db: Optional[Session] = None) -> List[Dict[str, Any]]:
    """
    Retrieves metadata (table name, filename, row count, columns) for all
    dynamically created uploaded dataset tables in PostgreSQL / SQLite.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        is_sqlite = db.bind.dialect.name == "sqlite" if db.bind else False
        table_cols_map: Dict[str, List[Dict[str, str]]] = {}

        if is_sqlite:
            # Query sqlite_master for uploaded tables
            tables = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'uploaded_%'")).fetchall()
            for (tname,) in tables:
                col_rows = db.execute(text(f"PRAGMA table_info({tname})")).fetchall()
                table_cols_map[tname] = [{"column": cr[1], "type": cr[2]} for cr in col_rows]
        else:
            # Fetch columns from PostgreSQL information_schema
            sql_cols = """
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name LIKE 'uploaded_%' 
            ORDER BY table_name, ordinal_position;
            """
            rows = db.execute(text(sql_cols)).fetchall()
            for r in rows:
                tname, cname, dtype = r[0], r[1], r[2]
                if tname not in table_cols_map:
                    table_cols_map[tname] = []
                table_cols_map[tname].append({"column": cname, "type": dtype})

        # Fetch associated Dataset metadata if available
        datasets = db.query(Dataset).filter(Dataset.table_name.isnot(None)).all()
        ds_map = {d.table_name: d for d in datasets}

        result = []
        for tname, cols in table_cols_map.items():
            ds = ds_map.get(tname)
            result.append({
                "table_name": tname,
                "filename": ds.filename if ds else tname.replace("uploaded_", ""),
                "row_count": ds.row_count if ds else None,
                "dataset_type": ds.dataset_type if ds else "custom",
                "columns": cols
            })

        return result
    except Exception as e:
        logger.warning(f"Error fetching uploaded tables metadata: {e}")
        return []
    finally:
        if should_close:
            db.close()


def backfill_existing_datasets():
    """
    Backfills database tables for any datasets in the database that don't have a table yet.
    """
    db = SessionLocal()
    try:
        datasets = db.query(Dataset).filter(Dataset.data.isnot(None)).order_by(Dataset.id.desc()).all()
        logger.info(f"Checking {len(datasets)} datasets for backfill...")
        for ds in datasets[:5]:  # Backfill the most recent 5 datasets
            if not ds.table_name and ds.data:
                try:
                    tname = create_uploaded_table(ds.id, ds.filename, ds.data, db=db)
                    logger.info(f"Backfilled table {tname} for dataset {ds.id} ({ds.filename})")
                except Exception as e:
                    logger.error(f"Error backfilling dataset {ds.id}: {e}")
    finally:
        db.close()
