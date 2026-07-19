import pandas as pd
import io
from typing import List, Dict, Any

def clean_dataset(file_content: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Cleans the uploaded dataset using pandas.
    - Handles CSV and Excel files.
    - Drops duplicates.
    - Fills missing numeric values with 0 and strings with 'Unknown'.
    """
    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_content))
    elif filename.endswith((".xls", ".xlsx")):
        df = pd.read_excel(io.BytesIO(file_content))
    else:
        raise ValueError("Unsupported file format. Please upload a CSV or Excel file.")

    # Drop exact duplicates
    df = df.drop_duplicates()

    # Handle missing values
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            df[col] = df[col].fillna(0)
        else:
            df[col] = df[col].fillna("Unknown")

    return df.to_dict(orient="records")
