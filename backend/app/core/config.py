import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(override=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "BusinessGPT"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+pg8000://postgres:postgres@localhost:5432/businessgpt").strip()
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    NEWSAPI_KEY: str = os.getenv("NEWSAPI_KEY", "").strip()
    # Twilio — Phase 7
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    TWILIO_WHATSAPP_NUMBER: str = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886").strip()

settings = Settings()
