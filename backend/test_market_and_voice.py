import unittest
import io
from fastapi.testclient import TestClient
from app.main import app
from app.core.auth import create_access_token

class TestMarketAndVoice(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Generate valid test token for authenticated endpoints
        cls.token = create_access_token(data={"sub": "1", "name": "Aditya (Owner)", "role": "OWNER"})
        cls.auth_headers = {"Authorization": f"Bearer {cls.token}"}

    def test_1_seasonal_opportunities_endpoint(self):
        """Test GET /api/market/seasonal returns active and upcoming month opportunities."""
        res = self.client.get("/api/market/seasonal")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("current_month_opportunity", data)
        self.assertIn("next_month_opportunity", data)
        self.assertIn("full_calendar", data)
        self.assertTrue(len(data["full_calendar"]) >= 12, "Calendar must contain all 12 months")

    def test_2_market_trends_endpoint(self):
        """Test POST /api/market/trends returns trend direction and recommendations."""
        res = self.client.post("/api/market/trends", json={"category": "Grocery", "region": "IN"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["category"], "Grocery")
        self.assertIn("trend_direction", data)
        self.assertIn(data["trend_direction"], ["rising", "falling", "stable"])
        self.assertIn("trending_products", data)
        self.assertIsInstance(data["trending_products"], list)
        self.assertIn("recommendation", data)
        self.assertTrue(len(data["recommendation"]) > 0)
        self.assertIn("data_sources", data)

    def test_3_voice_transcribe_validation_empty_file(self):
        """Test POST /api/chat/transcribe rejects empty audio files."""
        files = {"file": ("empty.webm", io.BytesIO(b""), "audio/webm")}
        res = self.client.post("/api/chat/transcribe", files=files, headers=self.auth_headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("empty", res.json().get("detail", "").lower())

    def test_4_voice_transcribe_validation_unsupported_format(self):
        """Test POST /api/chat/transcribe rejects unsupported file extensions/types."""
        files = {"file": ("malicious.exe", io.BytesIO(b"fake executable binary"), "application/x-msdownload")}
        res = self.client.post("/api/chat/transcribe", files=files, headers=self.auth_headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("unsupported", res.json().get("detail", "").lower())

    def test_5_voice_transcribe_validation_size_limit(self):
        """Test POST /api/chat/transcribe rejects oversized files."""
        # Max limit is 25MB. Test with 26MB dummy bytes
        large_bytes = b"0" * (26 * 1024 * 1024)
        files = {"file": ("large_audio.webm", io.BytesIO(large_bytes), "audio/webm")}
        res = self.client.post("/api/chat/transcribe", files=files, headers=self.auth_headers)
        self.assertEqual(res.status_code, 400)
        self.assertIn("exceeds", res.json().get("detail", "").lower())

if __name__ == "__main__":
    unittest.main()
