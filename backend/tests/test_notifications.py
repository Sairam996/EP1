"""
Backend notification-trigger tests for EventPro.
Verifies that MOCK mode Push (Emergent) + Email (Resend) helpers are invoked by
the parent endpoints and log the expected '[EMAIL mock]' / '[PUSH mock]' lines
in /var/log/supervisor/backend.err.log, while parent endpoints still succeed.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://pro-events-india.preview.emergentagent.com").rstrip("/")
LOG_PATH = "/var/log/supervisor/backend.err.log"

CUSTOMER_EMAIL = "customer.demo@eventpro.in"
CUSTOMER_PASS = "Demo@123"
VENDOR_EMAIL = "vendor1@eventpro.in"
VENDOR_PASS = "Vendor@123"


# ── Helpers ──────────────────────────────────────────────────────────────────
def _log_size() -> int:
    try:
        return os.path.getsize(LOG_PATH)
    except FileNotFoundError:
        return 0


def _log_since(offset: int, wait_s: float = 1.5) -> str:
    """Return log bytes appended since `offset`. Retries briefly to allow flush."""
    end = time.time() + wait_s
    txt = ""
    while time.time() < end:
        try:
            with open(LOG_PATH, "rb") as f:
                f.seek(offset)
                txt = f.read().decode("utf-8", errors="replace")
        except FileNotFoundError:
            txt = ""
        if txt.strip():
            break
        time.sleep(0.2)
    return txt


def _auth(email: str, password: str):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    d = r.json()
    return d["token"], d["user"], {"Authorization": f"Bearer {d['token']}", "Content-Type": "application/json"}


# ── Session-scoped fixtures ──────────────────────────────────────────────────
@pytest.fixture(scope="module")
def customer():
    token, user, headers = _auth(CUSTOMER_EMAIL, CUSTOMER_PASS)
    return {"token": token, "user": user, "headers": headers}


@pytest.fixture(scope="module")
def vendor():
    token, user, headers = _auth(VENDOR_EMAIL, VENDOR_PASS)
    return {"token": token, "user": user, "headers": headers}


@pytest.fixture(scope="module")
def vendor_row(vendor):
    """The vendor object owned by vendor1 (Taj Krishna Banquets)."""
    r = requests.get(f"{BASE_URL}/api/vendors", timeout=15)
    assert r.status_code == 200
    vendors = r.json()
    owner_id = vendor["user"]["id"]
    for v in vendors:
        if v.get("owner_id") == owner_id:
            return v
    # fallback: filter by vendor_id
    vid = vendor["user"].get("vendor_id")
    for v in vendors:
        if v["id"] == vid:
            return v
    pytest.skip("Vendor row for vendor1 not found in public vendor list")


# ── Health check ─────────────────────────────────────────────────────────────
def test_api_root_alive():
    r = requests.get(f"{BASE_URL}/api/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ── 1) Login triggers login-alert EMAIL mock ─────────────────────────────────
def test_login_triggers_email_mock():
    off = _log_size()
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    assert "token" in r.json() and "user" in r.json()
    logs = _log_since(off, wait_s=2.0)
    assert "[EMAIL mock]" in logs, f"Missing [EMAIL mock] after login. Logs:\n{logs[-2000:]}"
    assert f"to={CUSTOMER_EMAIL}" in logs, f"Login mock did not target customer email. Logs:\n{logs[-2000:]}"
    assert "New sign-in to your EventPro account" in logs, f"Login subject missing. Logs:\n{logs[-2000:]}"


# ── 2) Register succeeds without notification-related 500 ────────────────────
def test_register_succeeds_and_no_500():
    off = _log_size()
    uniq = uuid.uuid4().hex[:8]
    payload = {
        "name": f"TEST User {uniq}",
        "email": f"test_notify_{uniq}@example.com",
        "phone": f"9{uniq[:9]}",
        "password": "Test@1234",
        "role": "customer",
        "city": "Hyderabad",
    }
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    assert "token" in r.json()
    # Even if no explicit welcome email is wired, endpoint must succeed and not crash logger
    logs = _log_since(off, wait_s=1.0)
    assert " ERROR " not in logs, f"Unexpected ERROR on register:\n{logs[-2000:]}"


# ── 3) POST /bookings triggers 2x EMAIL + 2x PUSH mocks ──────────────────────
@pytest.fixture(scope="module")
def created_booking(customer, vendor_row):
    off = _log_size()
    body = {
        "vendor_id": vendor_row["id"],
        "event_type": "wedding",
        "event_date": "2026-12-20",
        "guests": 150,
        "notes": "TEST notification booking",
        "amount": 250000,
    }
    r = requests.post(f"{BASE_URL}/api/bookings", headers=customer["headers"], json=body, timeout=20)
    assert r.status_code in (200, 201), f"booking failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("id"), f"booking id missing in response: {data}"
    logs = _log_since(off, wait_s=2.5)
    return {"booking": data, "logs": logs, "vendor_row": vendor_row}


def test_booking_creates_two_email_and_two_push_mocks(created_booking, customer):
    logs = created_booking["logs"]
    booking = created_booking["booking"]
    email_count = logs.count("[EMAIL mock]")
    push_count = logs.count("[PUSH mock]")
    assert email_count >= 2, f"expected >=2 [EMAIL mock] on booking, got {email_count}. Logs:\n{logs[-2500:]}"
    assert push_count >= 2, f"expected >=2 [PUSH mock] on booking, got {push_count}. Logs:\n{logs[-2500:]}"
    # Customer confirmation must include customer email + "Booking request sent to"
    assert f"to={CUSTOMER_EMAIL}" in logs
    assert "Booking request sent to" in logs
    # Vendor inquiry must include vendor1 email + "New inquiry"
    assert VENDOR_EMAIL in logs, "vendor1 email not present in booking notifications"
    assert "New inquiry" in logs
    # Push mocks
    assert "'Booking request sent'" in logs or "Booking request sent" in logs
    assert booking["status"] == "pending"


# ── 4) Vendor updates booking → status EMAIL + PUSH mock (confirmed) ────────
def test_status_confirmed_triggers_mocks(created_booking, vendor):
    bid = created_booking["booking"]["id"]
    off = _log_size()
    r = requests.patch(f"{BASE_URL}/api/bookings/{bid}/status",
                       headers=vendor["headers"],
                       params={"status_val": "confirmed"}, timeout=15)
    assert r.status_code == 200, f"status update failed: {r.status_code} {r.text}"
    assert r.json().get("status") == "confirmed"
    logs = _log_since(off, wait_s=2.0)
    assert "[EMAIL mock]" in logs, f"missing EMAIL mock on confirm. Logs:\n{logs[-2000:]}"
    assert "[PUSH mock]" in logs, f"missing PUSH mock on confirm. Logs:\n{logs[-2000:]}"
    assert "confirmed" in logs
    assert f"to={CUSTOMER_EMAIL}" in logs


# ── 5) POST /reviews triggers vendor EMAIL + PUSH mock ───────────────────────
def test_review_triggers_vendor_mocks(customer, created_booking):
    off = _log_size()
    body = {
        "vendor_id": created_booking["vendor_row"]["id"],
        "booking_id": created_booking["booking"]["id"],
        "rating": 5,
        "comment": "TEST notification review — excellent service",
    }
    r = requests.post(f"{BASE_URL}/api/reviews", headers=customer["headers"], json=body, timeout=15)
    assert r.status_code in (200, 201), f"review failed: {r.status_code} {r.text}"
    assert r.json().get("id")
    logs = _log_since(off, wait_s=2.0)
    assert "[EMAIL mock]" in logs, f"missing EMAIL mock on review. Logs:\n{logs[-2000:]}"
    assert "[PUSH mock]" in logs, f"missing PUSH mock on review. Logs:\n{logs[-2000:]}"
    assert VENDOR_EMAIL in logs, "vendor1 email not present in review notification"
    assert "5-star review" in logs or "5\u2605" in logs or "5★" in logs


# ── 6) Payments mock flow → payment receipt EMAIL + PUSH mock ────────────────
def test_payment_verify_mock_triggers_receipt_notifications(customer, vendor_row):
    # Create a fresh booking (previous one may already be paid/reviewed)
    body = {
        "vendor_id": vendor_row["id"],
        "event_type": "birthday",
        "event_date": "2026-11-15",
        "guests": 50,
        "notes": "TEST payment notify",
        "amount": 100000,
    }
    r = requests.post(f"{BASE_URL}/api/bookings", headers=customer["headers"], json=body, timeout=20)
    assert r.status_code in (200, 201), r.text
    bid = r.json()["id"]

    # Order
    r = requests.post(f"{BASE_URL}/api/payments/order",
                      headers=customer["headers"],
                      json={"booking_id": bid, "redeem_points": 0}, timeout=15)
    assert r.status_code == 200, f"order failed: {r.status_code} {r.text}"
    order = r.json()
    assert order["mode"] == "mock", f"expected PAYMENT_MODE=mock, got {order}"
    assert order["order_id"].startswith("order_mock_"), order

    # Verify (mock short-circuits signature check)
    off = _log_size()
    r = requests.post(f"{BASE_URL}/api/payments/verify",
                      headers=customer["headers"],
                      json={
                          "booking_id": bid,
                          "razorpay_order_id": order["order_id"],
                          "razorpay_payment_id": f"pay_mock_{uuid.uuid4().hex[:14]}",
                          "razorpay_signature": "mock_signature",
                      }, timeout=20)
    assert r.status_code == 200, f"verify failed: {r.status_code} {r.text}"
    resp = r.json()
    assert resp.get("success") is True
    assert "earned_points" in resp
    logs = _log_since(off, wait_s=2.0)
    assert "[EMAIL mock]" in logs, f"missing EMAIL mock on payment. Logs:\n{logs[-2000:]}"
    assert "[PUSH mock]" in logs, f"missing PUSH mock on payment. Logs:\n{logs[-2000:]}"
    assert "Payment receipt" in logs, "payment receipt subject missing"
    assert "Payment successful" in logs, "payment push title missing"

    # Booking should now be paid + points reflected
    r = requests.get(f"{BASE_URL}/api/bookings/{bid}", headers=customer["headers"], timeout=15)
    assert r.status_code == 200
    b = r.json()
    assert b["payment_status"] == "paid"
    assert b["status"] == "confirmed"


# ── 7) POST /register-push → 201 + [PUSH mock] register log line ─────────────
def test_register_push_mock(customer):
    off = _log_size()
    body = {
        "user_id": customer["user"]["id"],
        "platform": "web",
        "device_token": "TEST_TOKEN_" + uuid.uuid4().hex,
    }
    r = requests.post(f"{BASE_URL}/api/register-push", json=body, timeout=15)
    assert r.status_code == 201, f"register-push failed: {r.status_code} {r.text}"
    assert r.json() == {"status": "registered"}
    logs = _log_since(off, wait_s=1.5)
    assert "[PUSH mock] register" in logs, f"[PUSH mock] register log missing. Logs:\n{logs[-1500:]}"
    assert f"user={customer['user']['id']}" in logs
    assert "platform=web" in logs


# ── 8) Additional status transitions: rejected + completed ───────────────────
def test_status_rejected_and_completed_trigger_mocks(customer, vendor, vendor_row):
    # Two new bookings — one for reject, one for complete
    for status_val in ("rejected", "completed"):
        r = requests.post(f"{BASE_URL}/api/bookings",
                          headers=customer["headers"],
                          json={
                              "vendor_id": vendor_row["id"],
                              "event_type": "sangeet",
                              "event_date": "2027-01-10",
                              "guests": 80,
                              "notes": f"TEST {status_val} notify",
                              "amount": 80000,
                          }, timeout=20)
        assert r.status_code in (200, 201), r.text
        bid = r.json()["id"]
        off = _log_size()
        r = requests.patch(f"{BASE_URL}/api/bookings/{bid}/status",
                           headers=vendor["headers"],
                           params={"status_val": status_val}, timeout=15)
        assert r.status_code == 200, f"{status_val} failed: {r.status_code} {r.text}"
        logs = _log_since(off, wait_s=2.0)
        assert "[EMAIL mock]" in logs, f"missing EMAIL mock on {status_val}. Logs:\n{logs[-1500:]}"
        assert "[PUSH mock]" in logs, f"missing PUSH mock on {status_val}. Logs:\n{logs[-1500:]}"


# ── 9) Notifications are non-blocking: parent still succeeds ─────────────────
def test_notifications_are_non_blocking(customer, vendor_row):
    """Even in a rapid-fire sequence, every parent endpoint must return 2xx."""
    for _ in range(2):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASS}, timeout=15)
        assert r.status_code == 200
    r = requests.post(f"{BASE_URL}/api/bookings",
                      headers=customer["headers"],
                      json={
                          "vendor_id": vendor_row["id"],
                          "event_type": "corporate",
                          "event_date": "2027-02-14",
                          "guests": 40,
                          "notes": "TEST non-blocking",
                          "amount": 40000,
                      }, timeout=20)
    assert r.status_code in (200, 201)
