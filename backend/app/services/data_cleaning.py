import pandas as pd
import io
import json
from typing import List, Dict, Any

def clean_dataset(file_content: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Cleans the uploaded dataset using pandas.
    - Handles CSV (.csv) and Excel (.xlsx, .xls) files case-insensitively.
    - Handles encoding fallbacks (utf-8-sig, utf-8, latin-1).
    - Normalizes column names (strips whitespace).
    - Drops duplicates.
    - Normalizes dates/timestamps to ISO string format for JSON serialization.
    - Fills missing numeric values with 0 and strings with 'Unknown'.
    """
    if not file_content:
        raise ValueError("Uploaded file is empty.")

    fname = (filename or "").lower().strip()

    if fname.endswith(".csv"):
        try:
            df = pd.read_csv(io.BytesIO(file_content), encoding="utf-8-sig")
        except UnicodeDecodeError:
            try:
                df = pd.read_csv(io.BytesIO(file_content), encoding="latin-1")
            except Exception as e:
                raise ValueError(f"Could not parse CSV file: {e}")
        except Exception as e:
            raise ValueError(f"Could not parse CSV file: {e}")
    elif fname.endswith((".xls", ".xlsx")):
        try:
            df = pd.read_excel(io.BytesIO(file_content))
        except Exception as e:
            raise ValueError(f"Could not parse Excel file: {e}")
    else:
        raise ValueError("Unsupported file format. Please upload a CSV (.csv) or Excel (.xlsx, .xls) file.")

    if df.empty:
        raise ValueError("The uploaded file contains no data rows.")

    # Clean and strip column names
    df.columns = [str(c).strip() for c in df.columns]

    # Drop exact duplicates
    df = df.drop_duplicates()

    # Handle datetime and missing values
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            df[col] = df[col].dt.strftime("%Y-%m-%d").fillna("")
        elif pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(0)
        else:
            df[col] = df[col].fillna("Unknown")

    # Use to_json -> json.loads to guarantee 100% JSON-serializable native Python types
    # (prevents Timestamp/int64/float serialization crashes in PostgreSQL JSON columns)
    cleaned_records = json.loads(df.to_json(orient="records", date_format="iso"))
    return cleaned_records
