import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(override=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "BusinessGPT"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+pg8000://postgres:postgres@localhost:5432/businessgpt").strip()
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()

settings = Settings()
