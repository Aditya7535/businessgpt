import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(override=True)

def _normalize_database_url(url: str) -> str:
    url = url.strip()
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+pg8000://", 1)
    if url.startswith("postgresql://") and not url.startswith("postgresql+"):
        return url.replace("postgresql://", "postgresql+pg8000://", 1)
    return url

class Settings(BaseSettings):
    PROJECT_NAME: str = "BusinessGPT"
    DATABASE_URL: str = _normalize_database_url(
        os.getenv("DATABASE_URL", "postgresql+pg8000://postgres:postgres@localhost:5432/businessgpt")
    )
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    NEWSAPI_KEY: str = os.getenv("NEWSAPI_KEY", "").strip()
    # Twilio — Phase 7
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    TWILIO_WHATSAPP_NUMBER: str = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886").strip()
    # Production / Deployment
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "").strip()
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000").strip()
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*").strip()
    PORT: int = int(os.getenv("PORT", "8000"))

settings = Settings()
