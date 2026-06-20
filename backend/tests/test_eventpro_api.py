"""EventPro backend full-suite tests covering auth, vendors, bookings, reviews,
favorites, chat, AI, payments (mock), KYC, vendor dashboard, role guards."""
import time
import uuid
import pytest


# ───────── Health & Catalog ─────────
class TestHealthAndCatalog:
    def test_health(self, api, base_url):
        r = api.get(f"{base_url}/api/")
        assert r.status_code == 200 and r.json().get("ok") is True

    def test_event_types(self, api, base_url):
        r = api.get(f"{base_url}/api/event-types")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 5
        assert {"id", "name", "icon"} <= set(data[0].keys())

    def test_categories(self, api, base_url):
        r = api.get(f"{base_url}/api/categories")
        assert r.status_code == 200 and len(r.json()) >= 5

    def test_cities(self, api, base_url):
        r = api.get(f"{base_url}/api/cities")
        cities = r.json()
        assert r.status_code == 200 and "Hyderabad" in cities and "Mumbai" in cities

    def test_combos(self, api, base_url):
        r = api.get(f"{base_url}/api/combos")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 3


# ───────── Auth ─────────
class TestAuth:
    def test_register_customer_and_me(self, api, base_url):
        email = f"TEST_cust_{uuid.uuid4().hex[:8]}@eventpro.in"
        r = api.post(f"{base_url}/api/auth/register",
                     json={"name": "TestCust", "email": email, "phone": "+91" + str(int(time.time())%10**10),
                           "password": "Test@123", "role": "customer", "city": "Mumbai"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and body["user"]["role"] == "customer"
        token = body["token"]
        # /me
        me = api.get(f"{base_url}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200 and me.json()["email"] == email

    def test_register_vendor(self, api, base_url):
        email = f"TEST_vend_{uuid.uuid4().hex[:8]}@eventpro.in"
        r = api.post(f"{base_url}/api/auth/register",
                     json={"name": "TestVend", "email": email, "phone": "+91" + str(int(time.time())%10**10),
                           "password": "Test@123", "role": "vendor", "city": "Delhi"})
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["role"] == "vendor" and u.get("vendor_id")

    def test_login_demo_customer(self, customer_auth):
        assert customer_auth["user"]["role"] == "customer"

    def test_login_demo_vendor(self, vendor_auth):
        assert vendor_auth["user"]["role"] == "vendor"
        assert vendor_auth["user"].get("vendor_id")

    def test_login_invalid(self, api, base_url):
        r = api.post(f"{base_url}/api/auth/login",
                     json={"email": "customer.demo@eventpro.in", "password": "wrong"})
        assert r.status_code == 401

    def test_me_unauth(self, api, base_url):
        r = api.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401


# ───────── Vendors ─────────
class TestVendors:
    def test_list_vendors(self, api, base_url):
        r = api.get(f"{base_url}/api/vendors")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 20
        v = data[0]
        for k in ("id", "name", "category", "city", "cover", "rating", "starting_price"):
            assert k in v

    def test_filter_by_city(self, api, base_url):
        r = api.get(f"{base_url}/api/vendors", params={"city": "Hyderabad"})
        assert r.status_code == 200
        assert all(v["city"] == "Hyderabad" for v in r.json())

    def test_filter_by_category(self, api, base_url):
        r = api.get(f"{base_url}/api/vendors", params={"category": "photography"})
        data = r.json()
        assert r.status_code == 200 and len(data) >= 1
        assert all(v["category"] == "photography" for v in data)

    def test_filter_by_event_type(self, api, base_url):
        r = api.get(f"{base_url}/api/vendors", params={"event_type": "wedding"})
        assert r.status_code == 200 and len(r.json()) > 0

    def test_search_q(self, api, base_url):
        r = api.get(f"{base_url}/api/vendors", params={"q": "Taj"})
        assert r.status_code == 200
        data = r.json()
        assert any("Taj" in v["name"] for v in data)

    def test_trending(self, api, base_url):
        r = api.get(f"{base_url}/api/vendors", params={"trending": True, "limit": 5})
        data = r.json()
        assert r.status_code == 200
        # Sorted by rating desc
        ratings = [v["rating"] for v in data]
        assert ratings == sorted(ratings, reverse=True)

    def test_get_vendor_detail(self, api, base_url):
        v_id = api.get(f"{base_url}/api/vendors").json()[0]["id"]
        r = api.get(f"{base_url}/api/vendors/{v_id}")
        assert r.status_code == 200 and r.json()["id"] == v_id

    def test_similar_vendors(self, api, base_url):
        v_id = api.get(f"{base_url}/api/vendors").json()[0]["id"]
        r = api.get(f"{base_url}/api/vendors/{v_id}/similar")
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_vendor_reviews_empty_ok(self, api, base_url):
        v_id = api.get(f"{base_url}/api/vendors").json()[0]["id"]
        r = api.get(f"{base_url}/api/vendors/{v_id}/reviews")
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_vendor_404(self, api, base_url):
        r = api.get(f"{base_url}/api/vendors/nonexistent")
        assert r.status_code == 404


# ───────── Bookings, Reviews, Payments (full flow) ─────────
class TestBookingFlow:
    @pytest.fixture(scope="class")
    def hyd_vendor(self, api, base_url):
        return api.get(f"{base_url}/api/vendors", params={"city": "Hyderabad"}).json()[0]

    def test_create_booking_customer(self, api, base_url, customer_auth, hyd_vendor):
        r = api.post(f"{base_url}/api/bookings", headers=customer_auth["headers"],
                     json={"vendor_id": hyd_vendor["id"], "event_type": "wedding",
                           "event_date": "2026-12-15", "guests": 200,
                           "notes": "TEST booking", "amount": 50000})
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "pending" and b["payment_status"] == "unpaid"
        assert b["vendor_name"] and b["customer_name"]
        pytest.booking_id = b["id"]
        pytest.test_vendor_id = hyd_vendor["id"]

    def test_create_booking_vendor_forbidden(self, api, base_url, vendor_auth, hyd_vendor):
        r = api.post(f"{base_url}/api/bookings", headers=vendor_auth["headers"],
                     json={"vendor_id": hyd_vendor["id"], "event_type": "wedding",
                           "event_date": "2026-12-15", "guests": 100, "amount": 10000})
        assert r.status_code == 403

    def test_list_customer_bookings(self, api, base_url, customer_auth):
        r = api.get(f"{base_url}/api/bookings", headers=customer_auth["headers"])
        assert r.status_code == 200
        ids = [b["id"] for b in r.json()]
        assert pytest.booking_id in ids

    def test_get_booking_detail(self, api, base_url, customer_auth):
        r = api.get(f"{base_url}/api/bookings/{pytest.booking_id}", headers=customer_auth["headers"])
        assert r.status_code == 200 and r.json()["id"] == pytest.booking_id

    def test_create_payment_order(self, api, base_url, customer_auth):
        r = api.post(f"{base_url}/api/payments/order", headers=customer_auth["headers"],
                     json={"booking_id": pytest.booking_id})
        assert r.status_code == 200
        data = r.json()
        assert data["order_id"].startswith("order_") and data["mode"] == "mock"
        pytest.order_id = data["order_id"]

    def test_verify_payment(self, api, base_url, customer_auth):
        r = api.post(f"{base_url}/api/payments/verify", headers=customer_auth["headers"],
                     json={"booking_id": pytest.booking_id,
                           "razorpay_order_id": pytest.order_id,
                           "razorpay_payment_id": "pay_mock_xyz",
                           "razorpay_signature": "sig_mock"})
        assert r.status_code == 200 and r.json()["success"] is True
        # Booking should now be paid + confirmed
        b = api.get(f"{base_url}/api/bookings/{pytest.booking_id}",
                    headers=customer_auth["headers"]).json()
        assert b["payment_status"] == "paid" and b["status"] == "confirmed"

    def test_add_review_recomputes_rating(self, api, base_url, customer_auth):
        before = api.get(f"{base_url}/api/vendors/{pytest.test_vendor_id}").json()
        r = api.post(f"{base_url}/api/reviews", headers=customer_auth["headers"],
                     json={"vendor_id": pytest.test_vendor_id, "booking_id": pytest.booking_id,
                           "rating": 5, "comment": "TEST excellent"})
        assert r.status_code == 200
        after = api.get(f"{base_url}/api/vendors/{pytest.test_vendor_id}").json()
        assert after["reviews_count"] == before["reviews_count"] + 1

    def test_vendor_can_update_booking_status(self, api, base_url, vendor_auth, customer_auth):
        # vendor1 owns the first Hyderabad vendor, which is the one customer booked
        r = api.patch(f"{base_url}/api/bookings/{pytest.booking_id}/status",
                      headers=vendor_auth["headers"],
                      params={"status_val": "completed"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "completed"

    def test_customer_cannot_update_status(self, api, base_url, customer_auth):
        r = api.patch(f"{base_url}/api/bookings/{pytest.booking_id}/status",
                      headers=customer_auth["headers"], params={"status_val": "cancelled"})
        assert r.status_code == 403


# ───────── Favorites ─────────
class TestFavorites:
    def test_toggle_favorite(self, api, base_url, customer_auth):
        v_id = api.get(f"{base_url}/api/vendors").json()[0]["id"]
        # ensure starting state (delete if exists)
        r1 = api.post(f"{base_url}/api/favorites/{v_id}", headers=customer_auth["headers"])
        r2 = api.post(f"{base_url}/api/favorites/{v_id}", headers=customer_auth["headers"])
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["favorited"] != r2.json()["favorited"]

    def test_list_favorites(self, api, base_url, customer_auth):
        v_id = api.get(f"{base_url}/api/vendors").json()[1]["id"]
        api.post(f"{base_url}/api/favorites/{v_id}", headers=customer_auth["headers"])
        r = api.get(f"{base_url}/api/favorites", headers=customer_auth["headers"])
        assert r.status_code == 200
        assert any(v["id"] == v_id for v in r.json())


# ───────── Chat ─────────
class TestChat:
    def test_chat_messages_round_trip(self, api, base_url, customer_auth, vendor_auth):
        bid = pytest.booking_id
        # customer sends
        r1 = api.post(f"{base_url}/api/chat/messages", headers=customer_auth["headers"],
                      json={"booking_id": bid, "text": "TEST hi vendor"})
        assert r1.status_code == 200
        # vendor sends
        r2 = api.post(f"{base_url}/api/chat/messages", headers=vendor_auth["headers"],
                      json={"booking_id": bid, "text": "TEST hi customer"})
        assert r2.status_code == 200
        # fetch as customer
        r3 = api.get(f"{base_url}/api/chat/messages/{bid}", headers=customer_auth["headers"])
        assert r3.status_code == 200 and len(r3.json()) >= 2

    def test_chat_threads(self, api, base_url, customer_auth):
        r = api.get(f"{base_url}/api/chat/threads", headers=customer_auth["headers"])
        assert r.status_code == 200 and isinstance(r.json(), list)
        assert any(t["booking_id"] == pytest.booking_id for t in r.json())


# ───────── AI ─────────
class TestAI:
    def test_ai_chat_returns_reply(self, api, base_url, customer_auth):
        r = api.post(f"{base_url}/api/ai/chat", headers=customer_auth["headers"],
                     json={"message": "Plan a 200-guest wedding in Hyderabad with INR 10L budget"},
                     timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("reply") and len(data["reply"]) > 0
        assert data.get("conversation_id")


# ───────── KYC ─────────
class TestKYC:
    def test_submit_kyc_sets_verified(self, api, base_url, vendor_auth):
        r = api.post(f"{base_url}/api/kyc", headers=vendor_auth["headers"],
                     json={"business_name": "TEST Biz", "pan_number": "ABCDE1234F",
                           "address": "TEST address", "gst_number": "27AAAAA0000A1Z5"})
        assert r.status_code == 200 and r.json()["status"] == "approved"
        v = api.get(f"{base_url}/api/vendor/me", headers=vendor_auth["headers"]).json()
        assert v["verified"] is True

    def test_get_my_kyc(self, api, base_url, vendor_auth):
        r = api.get(f"{base_url}/api/kyc/me", headers=vendor_auth["headers"])
        assert r.status_code == 200


# ───────── Vendor dashboard & services & availability ─────────
class TestVendorSelf:
    def test_dashboard(self, api, base_url, vendor_auth):
        r = api.get(f"{base_url}/api/vendor/dashboard", headers=vendor_auth["headers"])
        assert r.status_code == 200
        d = r.json()
        for k in ("total_bookings", "pending", "confirmed", "completed", "revenue", "views"):
            assert k in d

    def test_services_crud(self, api, base_url, vendor_auth):
        r1 = api.post(f"{base_url}/api/vendor/services", headers=vendor_auth["headers"],
                      json={"title": "TEST svc", "description": "TEST", "price": 25000, "photos": []})
        assert r1.status_code == 200
        sid = r1.json()["id"]
        r2 = api.get(f"{base_url}/api/vendor/services", headers=vendor_auth["headers"])
        assert any(s["id"] == sid for s in r2.json())
        r3 = api.delete(f"{base_url}/api/vendor/services/{sid}", headers=vendor_auth["headers"])
        assert r3.status_code == 200

    def test_availability(self, api, base_url, vendor_auth):
        r1 = api.post(f"{base_url}/api/vendor/availability", headers=vendor_auth["headers"],
                      json={"blocked_dates": ["2026-12-31"], "max_per_day": 2})
        assert r1.status_code == 200
        r2 = api.get(f"{base_url}/api/vendor/availability", headers=vendor_auth["headers"])
        assert "2026-12-31" in r2.json()["blocked_dates"]


# ───────── Role Guards ─────────
class TestRoleGuards:
    def test_customer_blocked_from_kyc(self, api, base_url, customer_auth):
        r = api.post(f"{base_url}/api/kyc", headers=customer_auth["headers"],
                     json={"business_name": "x", "pan_number": "x", "address": "x"})
        assert r.status_code == 403

    def test_customer_blocked_from_dashboard(self, api, base_url, customer_auth):
        r = api.get(f"{base_url}/api/vendor/dashboard", headers=customer_auth["headers"])
        assert r.status_code == 403

    def test_vendor_blocked_from_create_booking(self, api, base_url, vendor_auth):
        v = api.get(f"{base_url}/api/vendors").json()[0]
        r = api.post(f"{base_url}/api/bookings", headers=vendor_auth["headers"],
                     json={"vendor_id": v["id"], "event_type": "wedding",
                           "event_date": "2026-12-15", "amount": 1000})
        assert r.status_code == 403
