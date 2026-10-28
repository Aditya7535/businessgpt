import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from twilio.request_validator import RequestValidator

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.seed import seed_database
from app.core.auth import create_access_token
from app.models.user import User
from app.models.whatsapp import WhatsAppRegistration, WhatsAppMessageLog
from app.modules.alerts.scheduler import send_store_daily_digest


class TestWhatsAppEndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        seed_database()
        cls.client = TestClient(app)
        cls.db = SessionLocal()
        cls.mock_token = "mock_auth_token_32_characters_ok"
        cls.mock_sid = "ACmockaccountsid1234567890abcdef"
        cls.owner_token = create_access_token(data={"sub": "1", "name": "Aditya (Owner)", "role": "OWNER"})

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        self.orig_sid = settings.TWILIO_ACCOUNT_SID
        self.orig_token = settings.TWILIO_AUTH_TOKEN
        self.orig_base = settings.WHATSAPP_WEBHOOK_BASE_URL
        self.orig_digest = settings.WHATSAPP_DAILY_DIGEST_ENABLED

        settings.TWILIO_ACCOUNT_SID = self.mock_sid
        settings.TWILIO_AUTH_TOKEN = self.mock_token
        settings.WHATSAPP_WEBHOOK_BASE_URL = "http://testserver"

        # Clean slate for test MessageSids and temporary test phone numbers
        self.db.query(WhatsAppMessageLog).delete()
        self.db.query(WhatsAppRegistration).filter(
            WhatsAppRegistration.phone_number == "+919123456789"
        ).delete()
        self.db.commit()

    def tearDown(self):
        settings.TWILIO_ACCOUNT_SID = self.orig_sid
        settings.TWILIO_AUTH_TOKEN = self.orig_token
        settings.WHATSAPP_WEBHOOK_BASE_URL = self.orig_base
        settings.WHATSAPP_DAILY_DIGEST_ENABLED = self.orig_digest

    def _generate_signature(self, url: str, params: dict) -> str:
        validator = RequestValidator(self.mock_token)
        return validator.compute_signature(url, params)

    def test_1_router_mounted_at_api_whatsapp(self):
        """Verify WhatsApp router is mounted at /api/whatsapp with status and webhook endpoints."""
        res = self.client.get("/api/whatsapp/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("configured", data)
        self.assertIn("active_subscribers", data)
        self.assertIn("daily_digest_time", data)

    def test_2_webhook_rejects_missing_or_invalid_signature(self):
        """Webhook must reject requests without valid X-Twilio-Signature with 403."""
        payload = {
            "From": "whatsapp:+919876543210",
            "Body": "Hello",
            "MessageSid": "SM_test_sig_missing"
        }
        # No signature header
        res_no_sig = self.client.post("/api/whatsapp/webhook", data=payload)
        self.assertEqual(res_no_sig.status_code, 403)

        # Invalid signature header
        res_bad_sig = self.client.post(
            "/api/whatsapp/webhook",
            data=payload,
            headers={"X-Twilio-Signature": "invalid_signature"}
        )
        self.assertEqual(res_bad_sig.status_code, 403)

    def test_3_webhook_rejects_when_credentials_unconfigured(self):
        """Webhook must return 503 if server credentials are not configured."""
        settings.TWILIO_ACCOUNT_SID = ""
        settings.TWILIO_AUTH_TOKEN = ""
        payload = {"From": "whatsapp:+919876543210", "Body": "Hello"}
        res = self.client.post("/api/whatsapp/webhook", data=payload)
        self.assertEqual(res.status_code, 503)

    @patch("app.modules.whatsapp.handler._send_twilio_message")
    def test_4_authorized_owner_message_flow(self, mock_twilio):
        """Authorized store owner sending a question receives a BusinessGPT consultant response."""
        url = "http://testserver/api/whatsapp/webhook"
        payload = {
            "From": "whatsapp:+919876543210",  # Aditya (Owner) seeded number
            "Body": "Aaj ki sales kitni hui?",
            "MessageSid": "SM_valid_auth_owner_001",
            "To": "whatsapp:+14155238886"
        }
        sig = self._generate_signature(url, payload)

        res = self.client.post("/api/whatsapp/webhook", data=payload, headers={"X-Twilio-Signature": sig})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.text, "OK")

        # Verify outbound WhatsApp message was dispatched to owner via Twilio
        self.assertTrue(mock_twilio.called)
        sent_to, sent_text = mock_twilio.call_args[0][:2]
        self.assertIn("9876543210", sent_to)
        self.assertTrue(len(sent_text) > 0)

    @patch("app.modules.whatsapp.handler._send_twilio_message")
    def test_5_unknown_number_receives_onboarding_without_leaking_store_data(self, mock_twilio):
        """Unlinked stranger querying store data must receive an onboarding message rather than store metrics."""
        url = "http://testserver/api/whatsapp/webhook"
        stranger_phone = "+919999988888"
        payload = {
            "From": f"whatsapp:{stranger_phone}",
            "Body": "Kitna profit hua aur low stock batao?",
            "MessageSid": "SM_stranger_query_002",
            "To": "whatsapp:+14155238886"
        }
        sig = self._generate_signature(url, payload)

        res = self.client.post("/api/whatsapp/webhook", data=payload, headers={"X-Twilio-Signature": sig})
        self.assertEqual(res.status_code, 200)

        self.assertTrue(mock_twilio.called)
        sent_to, sent_text = mock_twilio.call_args[0][:2]
        # Must return onboarding text with linking instructions
        self.assertIn("linked nahi hai", sent_text.lower())
        self.assertIn("link", sent_text.lower())
        # Must NOT expose real store sales numbers
        self.assertNotIn("gross_profit", sent_text.lower())

    @patch("app.modules.whatsapp.handler._send_twilio_message")
    def test_6_webhook_idempotency_prevents_duplicate_processing(self, mock_twilio):
        """Duplicate webhook deliveries with the same MessageSid must be skipped without re-processing."""
        url = "http://testserver/api/whatsapp/webhook"
        duplicate_sid = "SM_idempotency_test_sid_999"
        payload = {
            "From": "whatsapp:+919876543210",
            "Body": "Hello idempotent test",
            "MessageSid": duplicate_sid,
            "To": "whatsapp:+14155238886"
        }
        sig = self._generate_signature(url, payload)

        # First delivery: processed and logged
        res1 = self.client.post("/api/whatsapp/webhook", data=payload, headers={"X-Twilio-Signature": sig})
        self.assertEqual(res1.status_code, 200)
        first_call_count = mock_twilio.call_count

        # Second delivery with exact same MessageSid (webhook retry)
        res2 = self.client.post("/api/whatsapp/webhook", data=payload, headers={"X-Twilio-Signature": sig})
        self.assertEqual(res2.status_code, 200)
        # Call count must NOT increase on retry
        self.assertEqual(mock_twilio.call_count, first_call_count, "Duplicate MessageSid must not trigger duplicate processing")

    @patch("app.modules.whatsapp.handler._send_twilio_message")
    def test_7_self_service_pin_linking(self, mock_twilio):
        """Unlinked user can link their WhatsApp number by replying with LINK <PIN>."""
        url = "http://testserver/api/whatsapp/webhook"
        unlinked_phone = "+919123456789"
        payload = {
            "From": f"whatsapp:{unlinked_phone}",
            "Body": "LINK 1111",  # Aditya (Owner) PIN
            "MessageSid": "SM_pin_link_test_003",
            "To": "whatsapp:+14155238886"
        }
        sig = self._generate_signature(url, payload)

        res = self.client.post("/api/whatsapp/webhook", data=payload, headers={"X-Twilio-Signature": sig})
        self.assertEqual(res.status_code, 200)

        self.assertTrue(mock_twilio.called)
        sent_to, sent_text = mock_twilio.call_args[0][:2]
        self.assertIn("successful", sent_text.lower())

        # Verify DB registration was created
        reg = self.db.query(WhatsAppRegistration).filter(
            WhatsAppRegistration.phone_number == unlinked_phone
        ).first()
        self.assertIsNotNone(reg)
        self.assertEqual(reg.user_id, 1)

    @patch("app.modules.whatsapp.handler._send_twilio_message")
    def test_8_scheduler_daily_digest_and_duplicate_prevention(self, mock_twilio):
        """Scheduler sends daily digest only when enabled and prevents duplicate sends on same day."""
        # Ensure owner is registered as subscriber and clear last_digest_date for initial test
        reg = self.db.query(WhatsAppRegistration).filter(
            WhatsAppRegistration.phone_number == "+919876543210"
        ).first()
        if not reg:
            reg = WhatsAppRegistration(phone_number="+919876543210", user_id=1, opt_in_digest=True, opt_in_alerts=True)
            self.db.add(reg)
        reg.opt_in_digest = True
        reg.last_digest_date = None
        self.db.commit()

        # 1. When disabled in settings: skips
        settings.WHATSAPP_DAILY_DIGEST_ENABLED = False
        sent = send_store_daily_digest(self.db, force=False)
        self.assertEqual(sent, 0)
        self.assertEqual(mock_twilio.call_count, 0)

        # 2. When enabled: delivers to opted-in subscribers
        settings.WHATSAPP_DAILY_DIGEST_ENABLED = True
        sent_initial = send_store_daily_digest(self.db, force=False)
        self.assertGreater(sent_initial, 0, "Must deliver daily digest to active subscribers")
        self.assertGreater(mock_twilio.call_count, 0)

        # 3. Second run on same calendar date: must be skipped (no duplicate digests)
        mock_twilio.reset_mock()
        sent_duplicate = send_store_daily_digest(self.db, force=False)
        self.assertEqual(sent_duplicate, 0, "Daily digest must not be sent twice on the same calendar day")
        self.assertEqual(mock_twilio.call_count, 0)


if __name__ == "__main__":
    unittest.main()
