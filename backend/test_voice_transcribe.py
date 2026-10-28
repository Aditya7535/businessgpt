import io
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.auth import create_access_token


class TestVoiceTranscribe(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.token = create_access_token(data={"sub": "1", "name": "Aditya (Owner)", "role": "OWNER"})
        cls.auth_headers = {"Authorization": f"Bearer {cls.token}"}

    def test_1_authentication_enforced(self):
        """Voice transcribe endpoint must require authentication."""
        files = {"file": ("audio.webm", io.BytesIO(b"dummy audio content"), "audio/webm")}
        res = self.client.post("/api/voice/transcribe", files=files)
        self.assertIn(res.status_code, [401, 403])

    def test_2_rejects_empty_audio_file(self):
        """Rejects empty audio file with 400 Bad Request."""
        files = {"file": ("empty.webm", io.BytesIO(b""), "audio/webm")}
        res = self.client.post("/api/voice/transcribe", files=files, headers=self.auth_headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("empty", res.json().get("detail", "").lower())

    def test_3_rejects_unsupported_audio_format(self):
        """Rejects unsupported extensions and MIME types with 400 Bad Request."""
        files = {"file": ("malicious.exe", io.BytesIO(b"binary exe"), "application/octet-stream")}
        res = self.client.post("/api/voice/transcribe", files=files, headers=self.auth_headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("unsupported", res.json().get("detail", "").lower())

    def test_4_rejects_oversized_audio_file(self):
        """Rejects files exceeding configured upload limit before consuming memory."""
        # Configured limit is 25MB; create 26MB dummy byte stream
        oversized = b"x" * (26 * 1024 * 1024)
        files = {"file": ("large_audio.webm", io.BytesIO(oversized), "audio/webm")}
        res = self.client.post("/api/voice/transcribe", files=files, headers=self.auth_headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("exceeds", res.json().get("detail", "").lower())

    @patch("groq.Groq")
    def test_5_successful_transcription_default_auto_language(self, mock_groq_class):
        """Valid audio upload successfully calls Groq Whisper and returns simple JSON text response."""
        mock_client = MagicMock()
        mock_groq_class.return_value = mock_client
        mock_transcription = MagicMock()
        mock_transcription.text = "Aaj ki total sales kitni hui?"
        mock_client.audio.transcriptions.create.return_value = mock_transcription

        audio_bytes = b"RIFF....WAVEfmt ....data...."
        files = {"file": ("query.wav", io.BytesIO(audio_bytes), "audio/wav")}

        res = self.client.post("/api/voice/transcribe", files=files, headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data, {"text": "Aaj ki total sales kitni hui?"})

        # Verify Groq client call parameters
        mock_client.audio.transcriptions.create.assert_called_once()
        call_kwargs = mock_client.audio.transcriptions.create.call_args[1]
        self.assertEqual(call_kwargs["model"], settings.GROQ_WHISPER_MODEL)
        self.assertNotIn("language", call_kwargs, "Language should not be forced when set to auto")

    @patch("groq.Groq")
    def test_6_transcription_with_explicit_language_hint(self, mock_groq_class):
        """Optional language hint (e.g. 'hi', 'mr') is passed to Groq Whisper."""
        mock_client = MagicMock()
        mock_groq_class.return_value = mock_client
        mock_transcription = MagicMock()
        mock_transcription.text = "आजचे एकूण उत्पन्न किती आहे?"
        mock_client.audio.transcriptions.create.return_value = mock_transcription

        audio_bytes = b"OggS....dummy ogg audio"
        files = {"file": ("audio.ogg", io.BytesIO(audio_bytes), "audio/ogg")}
        data_payload = {"language": "mr"}

        res = self.client.post("/api/voice/transcribe", files=files, data=data_payload, headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"text": "आजचे एकूण उत्पन्न किती आहे?"})

        call_kwargs = mock_client.audio.transcriptions.create.call_args[1]
        self.assertEqual(call_kwargs.get("language"), "mr")

    @patch("groq.Groq")
    def test_7_groq_rate_limit_error_handling(self, mock_groq_class):
        """Groq 429 rate limit returns HTTP 429 without exposing raw stack trace."""
        mock_client = MagicMock()
        mock_groq_class.return_value = mock_client
        mock_client.audio.transcriptions.create.side_effect = Exception("429 rate_limit_exceeded: TPM limit reached")

        audio_bytes = b"....dummy audio bytes"
        files = {"file": ("audio.webm", io.BytesIO(audio_bytes), "audio/webm")}

        res = self.client.post("/api/voice/transcribe", files=files, headers=self.auth_headers)
        self.assertEqual(res.status_code, 429)
        self.assertIn("rate limit", res.json().get("detail", "").lower())


if __name__ == "__main__":
    unittest.main()
