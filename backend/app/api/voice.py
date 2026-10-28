import io
import time
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.auth import require_role
from app.models.user import User

logger = logging.getLogger("businessgpt.voice")

router = APIRouter(prefix="/voice", tags=["voice"])

ALLOWED_AUDIO_EXTENSIONS = {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".flac", ".mp4"}
ALLOWED_AUDIO_MIMES = (
    "audio/webm", "audio/wav", "audio/x-wav", "audio/wave",
    "audio/mpeg", "audio/mp3", "audio/m4a", "audio/mp4", "audio/x-m4a",
    "audio/ogg", "audio/flac", "video/webm", "video/mp4"
)
CHUNK_READ_SIZE = 1024 * 1024  # 1MB buffer


class TranscribeResponse(BaseModel):
    text: str


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    file: UploadFile = File(..., description="Multipart audio file recorded from browser or mobile"),
    language: Optional[str] = Form(None, description="Optional language hint code e.g. 'hi', 'en', 'mr'"),
    current_user: User = Depends(require_role(["OWNER", "MANAGER", "EMPLOYEE"]))
):
    """
    Transcribes audio using Groq Whisper (default: whisper-large-v3).
    - Validates MIME type, non-empty payload, and enforces streaming upload limit.
    - Supports automatic language detection by default, or language hint when selected.
    - Zero recordings persisted to disk; purely processed in-memory buffer.
    - Never exposes Groq API keys to frontend client.
    """
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Voice transcription service is not configured on the server (GROQ_API_KEY missing)."
        )

    filename = (file.filename or "recording.webm").lower()
    ext = ("." + filename.rsplit(".", 1)[-1]) if "." in filename else ""
    content_type = (file.content_type or "").lower().split(";")[0].strip()

    # Format / Extension validation
    is_valid_format = (ext in ALLOWED_AUDIO_EXTENSIONS) or any(content_type == m or content_type.startswith(m) for m in ALLOWED_AUDIO_MIMES)
    if not is_valid_format:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio format '{content_type or ext}'. Supported formats: WebM, WAV, MP3, M4A, OGG, FLAC."
        )

    max_bytes = settings.MAX_AUDIO_UPLOAD_SIZE_MB * 1024 * 1024

    # Pre-check Content-Length header if sent by browser
    content_length_header = file.headers.get("content-length")
    if content_length_header and content_length_header.isdigit():
        if int(content_length_header) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Audio file exceeds maximum size limit of {settings.MAX_AUDIO_UPLOAD_SIZE_MB}MB."
            )

    # Stream read into memory buffer with progressive limit enforcement
    buffer = io.BytesIO()
    total_read = 0

    try:
        while True:
            chunk = await file.read(CHUNK_READ_SIZE)
            if not chunk:
                break
            total_read += len(chunk)
            if total_read > max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Audio file exceeds maximum size limit of {settings.MAX_AUDIO_UPLOAD_SIZE_MB}MB."
                )
            buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reading uploaded audio stream: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to read audio upload stream.")

    raw_bytes = buffer.getvalue()
    if not raw_bytes or len(raw_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded audio file is empty."
        )

    # Invoke Groq Whisper model
    safe_name = filename if ext in ALLOWED_AUDIO_EXTENSIONS else f"recording_{int(time.time())}.webm"

    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY, timeout=30.0)

        whisper_params = {
            "file": (safe_name, raw_bytes),
            "model": settings.GROQ_WHISPER_MODEL,
            "prompt": "Indian retail SME store sales, stock, inventory, products, bills, Hinglish Hindi English Marathi",
            "response_format": "json",
            "temperature": 0.0,
        }

        # Apply language hint only if explicitly specified and not 'auto'
        if language and language.strip().lower() not in ("auto", "none", ""):
            whisper_params["language"] = language.strip().lower()

        transcription = client.audio.transcriptions.create(**whisper_params)
        transcribed_text = (getattr(transcription, "text", "") or "").strip()

        return TranscribeResponse(text=transcribed_text)

    except Exception as e:
        err_msg = str(e)
        logger.error(f"Groq Whisper transcription failure: {err_msg}")
        if "401" in err_msg or "invalid_api_key" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Groq API key is invalid or expired.")
        elif "429" in err_msg or "rate_limit" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Voice transcription rate limit exceeded. Please wait a moment.")
        elif "timeout" in err_msg.lower():
            raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Voice transcription request timed out.")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice transcription service error: {err_msg[:120]}"
        )
