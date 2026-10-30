import os
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Ensure .env is loaded from backend directory and workspace root
_backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
if _backend_env.is_file():
    load_dotenv(_backend_env, override=True)
load_dotenv(override=True)

import urllib.parse

def _normalize_database_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return "sqlite:///./businessgpt.db"

    # Safely handle unencoded special characters (e.g. '@' in passwords)
    if "://" in url:
        scheme, rest = url.split("://", 1)
        if "/" in rest:
            auth_host, path = rest.split("/", 1)
            path = "/" + path
        else:
            auth_host, path = rest, ""
        
        if auth_host.count("@") > 1:
            user_pass, host_port = auth_host.rsplit("@", 1)
            if ":" in user_pass:
                user, password = user_pass.split(":", 1)
                encoded_password = urllib.parse.quote_plus(password)
                auth_host = f"{user}:{encoded_password}@{host_port}"
                url = f"{scheme}://{auth_host}{path}"

    if url.startswith("sqlite"):
        if "./businessgpt.db" in url or url == "sqlite:///./businessgpt.db":
            backend_db = Path(__file__).resolve().parent.parent.parent / "businessgpt.db"
            return f"sqlite:///{backend_db.as_posix()}"
        return url
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+pg8000://", 1)
    if url.startswith("postgresql://") and not url.startswith("postgresql+"):
        return url.replace("postgresql://", "postgresql+pg8000://", 1)
    return url

class Settings(BaseSettings):
    PROJECT_NAME: str = "BusinessGPT"
    DATABASE_URL: str = "postgresql+pg8000://postgres:postgres@localhost:5432/businessgpt"

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        return _normalize_database_url(v)

    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    NEWSAPI_KEY: str = os.getenv("NEWSAPI_KEY", "").strip()

    # Twilio / WhatsApp Configuration
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    # Support both TWILIO_WHATSAPP_FROM and TWILIO_WHATSAPP_NUMBER
    TWILIO_WHATSAPP_FROM: str = (os.getenv("TWILIO_WHATSAPP_FROM") or os.getenv("TWILIO_WHATSAPP_NUMBER") or "whatsapp:+14155238886").strip()
    TWILIO_WHATSAPP_NUMBER: str = (os.getenv("TWILIO_WHATSAPP_FROM") or os.getenv("TWILIO_WHATSAPP_NUMBER") or "whatsapp:+14155238886").strip()
    WHATSAPP_WEBHOOK_BASE_URL: str = os.getenv("WHATSAPP_WEBHOOK_BASE_URL", "").strip()
    WHATSAPP_DAILY_DIGEST_ENABLED: bool = os.getenv("WHATSAPP_DAILY_DIGEST_ENABLED", "false").lower() in ("true", "1", "yes")
    WHATSAPP_DAILY_DIGEST_TIME: str = os.getenv("WHATSAPP_DAILY_DIGEST_TIME", "09:00").strip()
    WHATSAPP_STORE_TIMEZONE: str = os.getenv("WHATSAPP_STORE_TIMEZONE", "Asia/Kolkata").strip()

    # Voice / Whisper Configuration
    GROQ_WHISPER_MODEL: str = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3").strip()
    MAX_AUDIO_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_AUDIO_UPLOAD_SIZE_MB", "25"))

    # Production / Deployment
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").strip()
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "").strip()
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000").strip()
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*").strip()
    PORT: int = int(os.getenv("PORT", "8000"))

settings = Settings()
