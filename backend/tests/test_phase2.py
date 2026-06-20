"""EventPro Phase 2 tests: Geo distance, Referrals, Loyalty points,
Points redemption in payments flow, WebSocket chat auth/broadcast/typing,
PATCH /vendor/me profile editor."""
import asyncio
import json
import time
import uuid
import pytest
import requests
import websockets


# ─────────────── Vendors with geo (Haversine distance_km) ───────────────
class TestVendorsGeo:
    def test_vendor_has_lat_lng(self, api, base_url):
        # _vendor_pub doesn't expose lat/lng but distance_km is present
        r = api.get(f"{base_url}/api/vendors", params={"city": "Hyderabad", "limit": 3})
        assert r.status_code == 200
        for v in r.json():
            assert "distance_km" in v

    def test_distance_changes_with_user_coords(self, api, base_url):
        # Hyderabad-ish coords (17.385, 78.486) vs Mumbai-ish (19.07, 72.87)
        r1 = api.get(f"{base_url}/api/vendors",
                     params={"city": "Hyderabad", "limit": 3, "lat": 17.385, "lng": 78.486})
        r2 = api.get(f"{base_url}/api/vendors",
                     params={"city": "Hyderabad", "limit": 3, "lat": 19.07, "lng": 72.87})
        assert r1.status_code == 200 and r2.status_code == 200
        a = r1.json()[0]; b = r2.json()[0]
        assert a["id"] == b["id"]
        # Hyderabad vendor should be closer when user is in Hyderabad than in Mumbai
        assert a["distance_km"] < b["distance_km"], f"{a['distance_km']} !< {b['distance_km']}"

    def test_vendor_detail_with_coords(self, api, base_url):
        v_id = api.get(f"{base_url}/api/vendors").json()[0]["id"]
        r = api.get(f"{base_url}/api/vendors/{v_id}", params={"lat": 17.4, "lng": 78.5})
        assert r.status_code == 200 and "distance_km" in r.json()


# ─────────────── Referrals & Points ───────────────
def _fresh_customer(api, base_url):
    email = f"TEST_p2_{uuid.uuid4().hex[:8]}@eventpro.in"
    r = api.post(f"{base_url}/api/auth/register",
                 json={"name": "P2 cust", "email": email,
                       "phone": "+91" + str(int(time.time() * 1000) % 10**10),
                       "password": "Test@123", "role": "customer", "city": "Mumbai"})
    assert r.status_code == 200, r.text
    return r.json()


class TestReferralsAndPoints:
    def test_demo_customer_referral_code(self, api, base_url, customer_auth):
        r = api.get(f"{base_url}/api/me/referral", headers=customer_auth["headers"])
        assert r.status_code == 200
        d = r.json()
        assert d["code"] == "EPDEMO1"
        assert "share_text" in d and d["code"] in d["share_text"]
        assert isinstance(d.get("invited_count", 0), int)

    def test_demo_customer_points_balance(self, api, base_url, customer_auth):
        r = api.get(f"{base_url}/api/me/points", headers=customer_auth["headers"])
        assert r.status_code == 200
        d = r.json()
        assert d["balance"] >= 0
        assert isinstance(d["history"], list)

    def test_apply_own_code_rejected(self, api, base_url, customer_auth):
        r = api.post(f"{base_url}/api/me/apply-referral",
                     headers=customer_auth["headers"], json={"code": "EPDEMO1"})
        assert r.status_code == 400, r.text

    def test_apply_invalid_code_rejected(self, api, base_url, customer_auth):
        # If demo customer already used a code, this returns 400 "already used"; else 404
        r = api.post(f"{base_url}/api/me/apply-referral",
                     headers=customer_auth["headers"], json={"code": "BOGUSXYZ"})
        assert r.status_code in (400, 404)

    def test_referral_flow_fresh_user_awards_both(self, api, base_url, customer_auth):
        # New user applies the demo customer's code → both get +200
        ref_before = api.get(f"{base_url}/api/me/points",
                             headers=customer_auth["headers"]).json()["balance"]
        new = _fresh_customer(api, base_url)
        h = {"Authorization": f"Bearer {new['token']}"}
        # New user starts with 0 points
        p0 = api.get(f"{base_url}/api/me/points", headers=h).json()
        assert p0["balance"] == 0
        r = api.post(f"{base_url}/api/me/apply-referral", headers=h, json={"code": "EPDEMO1"})
        assert r.status_code == 200, r.text
        assert r.json().get("awarded") == 200
        # New user now 200
        p1 = api.get(f"{base_url}/api/me/points", headers=h).json()
        assert p1["balance"] == 200
        assert any(e["reason"] == "referral_signup" and e["delta"] == 200 for e in p1["history"])
        # Demo customer +200
        ref_after = api.get(f"{base_url}/api/me/points",
                            headers=customer_auth["headers"]).json()["balance"]
        assert ref_after == ref_before + 200
        # Double-apply rejected
        r2 = api.post(f"{base_url}/api/me/apply-referral", headers=h, json={"code": "EPDEMO1"})
        assert r2.status_code == 400


# ─────────────── Payments with points redemption + earn ───────────────
# Use a fresh customer (200 pts via referral) + 10,000 INR booking so the 20%
# cap is the binding limit (2000), not the balance.
@pytest.fixture(scope="module")
def pay_ctx(api, base_url):
    new = _fresh_customer(api, base_url)
    h = {"Authorization": f"Bearer {new['token']}"}
    # Use demo referral code to seed 200 points
    api.post(f"{base_url}/api/me/apply-referral", headers=h, json={"code": "EPDEMO1"})
    bal = api.get(f"{base_url}/api/me/points", headers=h).json()["balance"]
    assert bal == 200
    v = api.get(f"{base_url}/api/vendors", params={"city": "Hyderabad"}).json()[0]
    r = api.post(f"{base_url}/api/bookings", headers=h,
                 json={"vendor_id": v["id"], "event_type": "wedding",
                       "event_date": "2027-02-10", "guests": 150,
                       "amount": 10000, "notes": "TEST p2 pay"})
    assert r.status_code == 200, r.text
    return {"headers": h, "booking_id": r.json()["id"], "starting_balance": 200}


class TestPaymentsPointsFlow:
    def test_order_caps_redeem_at_balance(self, api, base_url, pay_ctx):
        # Request 9999, balance=200, 20%cap=2000 → effective 200
        r = api.post(f"{base_url}/api/payments/order", headers=pay_ctx["headers"],
                     json={"booking_id": pay_ctx["booking_id"], "redeem_points": 9999})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["mode"] == "mock"
        assert d["order_id"].startswith("order_mock_")
        assert d["points_redeemed"] == 200
        assert d["final_amount"] == 9800
        assert d["amount"] == 980000
        pay_ctx["order_id"] = d["order_id"]

    def test_order_caps_at_20pct_when_balance_is_high(self, api, base_url, customer_auth):
        # Demo customer (may have varying balance after prior tests). Make a fresh
        # 10k booking and ask for 9999 → should be capped at min(balance, 9999, 2000).
        bal = api.get(f"{base_url}/api/me/points", headers=customer_auth["headers"]).json()["balance"]
        v = api.get(f"{base_url}/api/vendors", params={"city": "Hyderabad"}).json()[0]
        r = api.post(f"{base_url}/api/bookings", headers=customer_auth["headers"],
                     json={"vendor_id": v["id"], "event_type": "wedding",
                           "event_date": "2027-04-04", "amount": 10000})
        bid = r.json()["id"]
        r2 = api.post(f"{base_url}/api/payments/order", headers=customer_auth["headers"],
                      json={"booking_id": bid, "redeem_points": 9999})
        d = r2.json()
        expected = min(bal, 9999, 2000)
        assert d["points_redeemed"] == expected, d
        assert d["final_amount"] == 10000 - expected

    def test_verify_burns_and_earns(self, api, base_url, pay_ctx):
        bal_before = api.get(f"{base_url}/api/me/points",
                             headers=pay_ctx["headers"]).json()["balance"]
        r = api.post(f"{base_url}/api/payments/verify", headers=pay_ctx["headers"],
                     json={"booking_id": pay_ctx["booking_id"],
                           "razorpay_order_id": pay_ctx["order_id"],
                           "razorpay_payment_id": "pay_mock_p2",
                           "razorpay_signature": "sig_mock"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["redeemed_points"] == 200
        # 5% of final_amount (9800) = 490
        assert d["earned_points"] == 490
        bal_after = api.get(f"{base_url}/api/me/points",
                            headers=pay_ctx["headers"]).json()
        # -200 + 490 = +290
        assert bal_after["balance"] == bal_before - 200 + 490
        reasons = [e["reason"] for e in bal_after["history"][:5]]
        assert "earn" in reasons and "redeem" in reasons


# ─────────────── PATCH /vendor/me ───────────────
class TestVendorProfileEdit:
    def test_patch_vendor_me(self, api, base_url, vendor_auth):
        before = api.get(f"{base_url}/api/vendor/me", headers=vendor_auth["headers"]).json()
        new_desc = f"TEST p2 desc {uuid.uuid4().hex[:6]}"
        new_price = (before.get("starting_price", 50000) or 50000) + 1
        payload = {"description": new_desc, "starting_price": new_price,
                   "phone": "+919999000011", "lat": 17.4, "lng": 78.5,
                   "address": "TEST p2 address"}
        r = api.patch(f"{base_url}/api/vendor/me", headers=vendor_auth["headers"], json=payload)
        assert r.status_code == 200, r.text
        # Re-fetch
        after = api.get(f"{base_url}/api/vendor/me", headers=vendor_auth["headers"]).json()
        assert after["description"] == new_desc
        assert after["starting_price"] == new_price
        assert after.get("phone") == "+919999000011"

    def test_patch_vendor_ignores_unknown_fields(self, api, base_url, vendor_auth):
        r = api.patch(f"{base_url}/api/vendor/me", headers=vendor_auth["headers"],
                      json={"id": "HACK", "verified": False, "rating": 1.0})
        assert r.status_code == 200
        v = r.json()
        # id should not be HACK; rating should not be 1.0
        assert v["id"] != "HACK"
        assert v["rating"] != 1.0

    def test_customer_cannot_patch_vendor(self, api, base_url, customer_auth):
        r = api.patch(f"{base_url}/api/vendor/me", headers=customer_auth["headers"],
                      json={"description": "x"})
        assert r.status_code == 403


# ─────────────── WebSocket Chat ───────────────
def _ws_url(http_url: str, booking_id: str, token: str) -> str:
    base = http_url.replace("https://", "wss://").replace("http://", "ws://")
    return f"{base}/api/ws/chat/{booking_id}?token={token}"


def _login(api, base_url, email, password):
    r = api.post(f"{base_url}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    return r.json()


def _make_booking(api, base_url, cust_headers):
    v = api.get(f"{base_url}/api/vendors", params={"city": "Hyderabad"}).json()[0]
    r = api.post(f"{base_url}/api/bookings", headers=cust_headers,
                 json={"vendor_id": v["id"], "event_type": "wedding",
                       "event_date": "2027-03-15", "guests": 50, "amount": 5000})
    assert r.status_code == 200, r.text
    return r.json()["id"]


class TestWebSocketChat:
    @pytest.mark.asyncio
    async def test_ws_rejects_bad_token(self, base_url, customer_auth):
        # Need a real booking_id to reach the auth code path; use a customer-owned booking
        s = requests.Session(); s.headers.update({"Content-Type": "application/json"})
        bid = _make_booking(s, base_url, customer_auth["headers"])
        url = _ws_url(base_url, bid, "garbage.token.value")
        with pytest.raises(Exception) as ei:
            async with websockets.connect(url, open_timeout=8) as ws:
                await ws.recv()
        # Should be closed with 4401 or generic invalid status
        assert "4401" in str(ei.value) or "rejected" in str(ei.value).lower() \
            or "invalid" in str(ei.value).lower() or "401" in str(ei.value)

    @pytest.mark.asyncio
    async def test_ws_rejects_outsider_4403(self, api, base_url, customer_auth):
        s = requests.Session(); s.headers.update({"Content-Type": "application/json"})
        bid = _make_booking(s, base_url, customer_auth["headers"])
        # Random other customer who does NOT own this booking
        new = _fresh_customer(api, base_url)
        url = _ws_url(base_url, bid, new["token"])
        with pytest.raises(Exception) as ei:
            async with websockets.connect(url, open_timeout=8) as ws:
                await ws.recv()
        assert "4403" in str(ei.value) or "rejected" in str(ei.value).lower()

    @pytest.mark.asyncio
    async def test_ws_message_broadcast_and_persist(self, api, base_url,
                                                    customer_auth, vendor_auth):
        s = requests.Session(); s.headers.update({"Content-Type": "application/json"})
        bid = _make_booking(s, base_url, customer_auth["headers"])
        c_url = _ws_url(base_url, bid, customer_auth["token"])
        v_url = _ws_url(base_url, bid, vendor_auth["token"])
        async with websockets.connect(c_url, open_timeout=8) as cws, \
                   websockets.connect(v_url, open_timeout=8) as vws:
            await cws.send(json.dumps({"type": "message", "text": "TEST ws hello"}))
            # Both sockets should receive the broadcast (sender included)
            v_msg = json.loads(await asyncio.wait_for(vws.recv(), timeout=8))
            c_msg = json.loads(await asyncio.wait_for(cws.recv(), timeout=8))
            assert v_msg["type"] == "message"
            assert v_msg["message"]["text"] == "TEST ws hello"
            assert c_msg["type"] == "message"
            # Vendor sends typing → only customer receives, not vendor itself
            await vws.send(json.dumps({"type": "typing"}))
            ev = json.loads(await asyncio.wait_for(cws.recv(), timeout=5))
            assert ev["type"] == "typing"
            # Ensure vws did NOT receive its own typing within 1s
            try:
                stray = await asyncio.wait_for(vws.recv(), timeout=1.2)
                # If something arrived it must not be a typing echo of self
                stray_ev = json.loads(stray)
                assert not (stray_ev.get("type") == "typing"
                            and stray_ev.get("user_id") == vendor_auth["user"]["id"])
            except asyncio.TimeoutError:
                pass
        # Verify persistence via REST
        r = api.get(f"{base_url}/api/chat/messages/{bid}", headers=customer_auth["headers"])
        assert r.status_code == 200
        assert any(m.get("text") == "TEST ws hello" for m in r.json())
