import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from twilio.request_validator import RequestValidator
from app.modules.whatsapp.router import router as whatsapp_router
from app.core.config import settings

class TestWhatsAppSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_app = FastAPI()
        cls.test_app.include_router(whatsapp_router, prefix="/api")
        cls.client = TestClient(cls.test_app)

    def test_1_webhook_rejected_when_credentials_missing(self):
        """Webhook must return 503 if Twilio credentials are not set."""
        original_sid = settings.TWILIO_ACCOUNT_SID
        original_token = settings.TWILIO_AUTH_TOKEN
        try:
            settings.TWILIO_ACCOUNT_SID = ""
            settings.TWILIO_AUTH_TOKEN = ""
            res = self.client.post("/api/whatsapp/webhook", data={"Body": "Hello", "From": "whatsapp:+919876543210"})
            self.assertEqual(res.status_code, 503)
        finally:
            settings.TWILIO_ACCOUNT_SID = original_sid
            settings.TWILIO_AUTH_TOKEN = original_token

    def test_2_webhook_rejected_without_signature(self):
        """Webhook must return 403 when X-Twilio-Signature header is missing."""
        original_sid = settings.TWILIO_ACCOUNT_SID
        original_token = settings.TWILIO_AUTH_TOKEN
        try:
            settings.TWILIO_ACCOUNT_SID = "ACmockaccountsid00000000000000"
            settings.TWILIO_AUTH_TOKEN = "mockauthtoken1234567890abcdef"
            res = self.client.post("/api/whatsapp/webhook", data={"Body": "Hello", "From": "whatsapp:+919876543210"})
            self.assertEqual(res.status_code, 403)
            self.assertIn("invalid twilio webhook signature", res.json().get("detail", "").lower())
        finally:
            settings.TWILIO_ACCOUNT_SID = original_sid
            settings.TWILIO_AUTH_TOKEN = original_token

    def test_3_webhook_accepted_with_valid_signature(self):
        """Webhook accepts request when X-Twilio-Signature is valid."""
        original_sid = settings.TWILIO_ACCOUNT_SID
        original_token = settings.TWILIO_AUTH_TOKEN
        mock_token = "1234567890abcdef1234567890abcdef"
        try:
            settings.TWILIO_ACCOUNT_SID = "ACmockaccountsid00000000000000"
            settings.TWILIO_AUTH_TOKEN = mock_token

            url = "http://testserver/api/whatsapp/webhook"
            params = {"Body": "", "From": ""}  # Empty body will return 200 PlainTextResponse 'OK'
            validator = RequestValidator(mock_token)
            signature = validator.compute_signature(url, params)

            res = self.client.post(
                "/api/whatsapp/webhook",
                data=params,
                headers={"X-Twilio-Signature": signature}
            )
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.text, "OK")
        finally:
            settings.TWILIO_ACCOUNT_SID = original_sid
            settings.TWILIO_AUTH_TOKEN = original_token

if __name__ == "__main__":
    unittest.main()
