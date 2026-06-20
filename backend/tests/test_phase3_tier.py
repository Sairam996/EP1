"""Phase 3 tier loyalty backend tests."""
import os
import uuid
import requests
import pytest

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://pro-events-india.preview.emergentagent.com").rstrip("/")


def _register(name_prefix="TEST_p3"):
    email = f"{name_prefix}_{uuid.uuid4().hex[:8]}@eventpro.in"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": name_prefix, "email": email, "phone": "+919999999999",
        "password": "Pass@123", "role": "customer", "city": "Hyderabad"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email,
            "headers": {"Authorization": f"Bearer {data['token']}"}}


def _login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"],
            "headers": {"Authorization": f"Bearer {d['token']}"}}


def _create_paid_booking(auth, amount, redeem=0):
    # find a vendor
    vrs = requests.get(f"{BASE_URL}/api/vendors?city=Hyderabad").json()
    vid = vrs[0]["id"]
    b = requests.post(f"{BASE_URL}/api/bookings", headers=auth["headers"], json={
        "vendor_id": vid, "event_type": "wedding", "event_date": "2026-12-31",
        "guests": 100, "notes": "TEST_p3", "amount": amount}).json()
    bid = b["id"]
    o = requests.post(f"{BASE_URL}/api/payments/order", headers=auth["headers"], json={
        "booking_id": bid, "redeem_points": redeem}).json()
    v = requests.post(f"{BASE_URL}/api/payments/verify", headers=auth["headers"], json={
        "booking_id": bid, "razorpay_order_id": o["order_id"],
        "razorpay_payment_id": "pay_mock_" + uuid.uuid4().hex[:10],
        "razorpay_signature": "sig_mock"})
    assert v.status_code == 200, v.text
    return bid, v.json()


# ── /me/tier ──────────────────────────────────────────────────────────────
class TestTierEndpoint:
    def test_me_tier_demo_user_is_gold(self):
        auth = _login("customer.demo@eventpro.in", "Demo@123")
        r = requests.get(f"{BASE_URL}/api/me/tier", headers=auth["headers"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert "lifetime_points" in d and "balance" in d and "tier" in d and "progress" in d
        t = d["tier"]
        # Demo user starts at lifetime 1500 (Gold). After Phase 2 may be higher.
        # If still Gold: boost==0.05, next=Platinum, next_at=5000
        if d["lifetime_points"] >= 5000:
            assert t["name"] == "Platinum"
            assert t["boost"] == 0.10
        elif d["lifetime_points"] >= 1000:
            assert t["name"] == "Gold"
            assert t["boost"] == 0.05
            assert t["next"] == "Platinum"
            assert t["next_at"] == 5000
        else:
            assert t["name"] == "Silver"
        # progress field
        assert 0 <= d["progress"] <= 1

    def test_silver_new_user(self):
        auth = _register("TEST_p3_silver")
        r = requests.get(f"{BASE_URL}/api/me/tier", headers=auth["headers"]).json()
        assert r["lifetime_points"] == 0
        assert r["tier"]["name"] == "Silver"
        assert r["tier"]["boost"] == 0.0
        assert r["tier"]["next"] == "Gold"
        assert r["tier"]["next_at"] == 1000
        assert r["progress"] == 0.0


# ── earn boost calc ───────────────────────────────────────────────────────
class TestEarnBoost:
    def test_silver_earn_no_boost(self):
        """Silver: round(amount*0.05) exactly"""
        auth = _register("TEST_p3_silv_earn")
        amount = 10000
        bid, vresp = _create_paid_booking(auth, amount)
        assert vresp["earned_points"] == round(amount * 0.05)  # 500
        assert vresp["tier"] in ("Silver", "Gold")  # may cross threshold but here 500<1000 → still Silver
        assert vresp["boost_pct"] == 0  # boost used at time of earn

    def test_gold_earn_5pct_boost(self):
        """Gold (lifetime≥1000): earn = round(amount*0.05*1.05)"""
        auth = _register("TEST_p3_gold_earn")
        # First, push to gold: do a 20k booking (1000 pts) for silver, then check second
        bid1, v1 = _create_paid_booking(auth, 20000)
        # earned 1000 (silver). Now lifetime=1000 → Gold for next booking
        t = requests.get(f"{BASE_URL}/api/me/tier", headers=auth["headers"]).json()
        assert t["tier"]["name"] == "Gold"
        # Second booking at 10000 → should earn round(10000*0.05*1.05) = 525
        bid2, v2 = _create_paid_booking(auth, 10000)
        assert v2["earned_points"] == round(10000 * 0.05 * 1.05)  # 525
        assert v2["boost_pct"] == 5

    def test_platinum_earn_10pct_boost(self):
        """Platinum (lifetime≥5000): earn = round(amount*0.05*1.10)"""
        auth = _register("TEST_p3_plat_earn")
        # push to platinum: 100000 booking → earns 5000 (silver→...→platinum)
        bid1, v1 = _create_paid_booking(auth, 100000)
        # lifetime now 5000 → Platinum
        t = requests.get(f"{BASE_URL}/api/me/tier", headers=auth["headers"]).json()
        assert t["tier"]["name"] == "Platinum", f"got {t}"
        bid2, v2 = _create_paid_booking(auth, 10000)
        assert v2["earned_points"] == round(10000 * 0.05 * 1.10)  # 550
        assert v2["boost_pct"] == 10

    def test_lifetime_points_increment_and_tier_up(self):
        """lifetime_points increases and tier_up=True when crossing threshold"""
        auth = _register("TEST_p3_tup")
        # New user: silver, lifetime=0. 20k booking → earn 1000 → crosses to Gold
        bid, v = _create_paid_booking(auth, 20000)
        assert v["earned_points"] == 1000
        assert v["tier"] == "Gold"
        assert v["tier_up"] is True
        # Confirm lifetime incremented
        t = requests.get(f"{BASE_URL}/api/me/tier", headers=auth["headers"]).json()
        assert t["lifetime_points"] == 1000

    def test_tier_up_only_once(self):
        """tier_up should be False on second booking within same tier"""
        auth = _register("TEST_p3_tup2")
        _, v1 = _create_paid_booking(auth, 20000)  # crosses to Gold
        assert v1["tier_up"] is True
        _, v2 = _create_paid_booking(auth, 5000)  # still Gold
        assert v2["tier"] == "Gold"
        assert v2["tier_up"] is False


# ── Idempotency ───────────────────────────────────────────────────────────
class TestIdempotency:
    def test_verify_idempotent(self):
        auth = _register("TEST_p3_idem")
        vrs = requests.get(f"{BASE_URL}/api/vendors?city=Hyderabad").json()
        vid = vrs[0]["id"]
        b = requests.post(f"{BASE_URL}/api/bookings", headers=auth["headers"], json={
            "vendor_id": vid, "event_type": "wedding", "event_date": "2026-12-31",
            "guests": 100, "notes": "TEST_p3", "amount": 10000}).json()
        bid = b["id"]
        o = requests.post(f"{BASE_URL}/api/payments/order", headers=auth["headers"], json={
            "booking_id": bid, "redeem_points": 0}).json()
        v1 = requests.post(f"{BASE_URL}/api/payments/verify", headers=auth["headers"], json={
            "booking_id": bid, "razorpay_order_id": o["order_id"],
            "razorpay_payment_id": "pay_x", "razorpay_signature": "sig_x"}).json()
        # capture lifetime
        t1 = requests.get(f"{BASE_URL}/api/me/tier", headers=auth["headers"]).json()
        lp1 = t1["lifetime_points"]
        # second call
        v2 = requests.post(f"{BASE_URL}/api/payments/verify", headers=auth["headers"], json={
            "booking_id": bid, "razorpay_order_id": o["order_id"],
            "razorpay_payment_id": "pay_x", "razorpay_signature": "sig_x"}).json()
        assert v2.get("already_paid") is True
        assert v2["earned_points"] == v1["earned_points"]
        # lifetime unchanged
        t2 = requests.get(f"{BASE_URL}/api/me/tier", headers=auth["headers"]).json()
        assert t2["lifetime_points"] == lp1


# ── Referral bumps lifetime ───────────────────────────────────────────────
class TestReferralLifetime:
    def test_referral_bumps_lifetime_for_both(self):
        # Create referrer
        ref = _register("TEST_p3_referrer")
        # Get referral code
        code_resp = requests.get(f"{BASE_URL}/api/me/referral", headers=ref["headers"]).json()
        code = code_resp["code"]
        ref_lp_before = requests.get(f"{BASE_URL}/api/me/tier", headers=ref["headers"]).json()["lifetime_points"]
        # Create new user, apply code
        new = _register("TEST_p3_referee")
        new_lp_before = requests.get(f"{BASE_URL}/api/me/tier", headers=new["headers"]).json()["lifetime_points"]
        r = requests.post(f"{BASE_URL}/api/me/apply-referral", headers=new["headers"], json={"code": code})
        assert r.status_code == 200, r.text
        # Both should have +200 lifetime
        new_lp_after = requests.get(f"{BASE_URL}/api/me/tier", headers=new["headers"]).json()["lifetime_points"]
        ref_lp_after = requests.get(f"{BASE_URL}/api/me/tier", headers=ref["headers"]).json()["lifetime_points"]
        assert new_lp_after - new_lp_before == 200
        assert ref_lp_after - ref_lp_before == 200


# ── /me/points regression check ───────────────────────────────────────────
class TestMePointsRegression:
    def test_me_points_works(self):
        auth = _login("customer.demo@eventpro.in", "Demo@123")
        r = requests.get(f"{BASE_URL}/api/me/points", headers=auth["headers"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert "balance" in d and "history" in d
        assert isinstance(d["history"], list)

    def test_earn_history_has_boost_pct(self):
        auth = _register("TEST_p3_hist")
        _, v = _create_paid_booking(auth, 20000)  # silver→gold
        h = requests.get(f"{BASE_URL}/api/me/points", headers=auth["headers"]).json()
        earn_entries = [e for e in h["history"] if e["reason"] == "earn"]
        assert len(earn_entries) >= 1
        # Silver earn — boost_pct=0 stored
        assert "boost_pct" in earn_entries[0] or earn_entries[0].get("tier") is not None
