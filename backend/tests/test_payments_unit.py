"""Offline unit tests for checkout payments: orders, signature verify, webhook, tiered refunds, Route.

Runs against an in-memory Mongo (mongomock-motor) and a fake Razorpay client — no network, no keys.
    cd backend && python -m pytest tests/test_payments_unit.py -q
"""
import hashlib
import hmac
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import pytest

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1")
os.environ.setdefault("DB_NAME", "thara_unit")
os.environ.setdefault("JWT_SECRET_KEY", "unit-test-secret")
os.environ.setdefault("ADMIN_SECRET", "unit-admin")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402

IST = timezone(timedelta(hours=5, minutes=30))
SECRET = "unit_rzp_secret"


def _day(offset_days: int) -> str:
    return (datetime.now(IST) + timedelta(days=offset_days)).strftime("%Y-%m-%d")


class FakeRazorpay:
    def __init__(self):
        self.calls = []
        self.payments = {}

    async def __call__(self, method, path, payload=None):
        self.calls.append((method, path, payload))
        if method == "POST" and path == "/orders":
            return {"id": f"order_{uuid.uuid4().hex[:14]}", "amount": payload["amount"], "status": "created"}
        if method == "POST" and path == "/customers":
            return {"id": "cust_unit123"}
        if method == "GET" and path.startswith("/payments/"):
            return dict(self.payments[path.split("/")[2]])
        if method == "POST" and path.endswith("/capture"):
            pid = path.split("/")[2]
            self.payments[pid]["status"] = "captured"
            return dict(self.payments[pid])
        if method == "POST" and path.endswith("/refund"):
            return {"id": "rfnd_unit1", "status": "processed", "amount": payload["amount"]}
        if method == "POST" and path == "/transfers":
            return {"id": "trf_unit1"}
        raise AssertionError(f"unexpected Razorpay call {method} {path}")


@pytest.fixture()
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()[f"t_{uuid.uuid4().hex[:6]}"]
    monkeypatch.setattr(server, "db", db)

    async def _noop(*a, **k):
        return None
    monkeypatch.setattr(server, "send_push", _noop)
    monkeypatch.setattr(server, "send_email", _noop)
    monkeypatch.setattr(server, "PAYMENT_MODE", "mock")
    client = TestClient(server.app)

    cust = {"id": str(uuid.uuid4()), "role": "customer", "name": "Asha", "email": "asha@example.com",
            "phone": "9000000000", "points": 0, "lifetime_points": 0}
    vendor = {"id": str(uuid.uuid4()), "name": "Gold Tent Decor", "owner_id": "owner1", "category": "decor"}

    async def seed():
        await db.users.insert_one(dict(cust))
        await db.vendors.insert_one(dict(vendor))
    import anyio
    anyio.run(seed)
    headers = {"Authorization": f"Bearer {server.make_token(cust['id'], 'customer')}"}

    def booking(days=20, status="confirmed", amount=100000, **extra):
        doc = {"id": str(uuid.uuid4()), "vendor_id": vendor["id"], "customer_id": cust["id"],
               "event_type": "wedding", "event_date": _day(days), "guests": 200, "amount": amount,
               "status": status, "payment_status": "unpaid", "advance_paid": False, "balance_status": "due",
               "created_at": datetime.now(timezone.utc).isoformat(), **extra}
        anyio.run(db.bookings.insert_one, dict(doc))
        return doc["id"]

    def get(bid):
        return anyio.run(db.bookings.find_one, {"id": bid}, {"_id": 0})

    return {"client": client, "db": db, "h": headers, "booking": booking, "get": get,
            "vendor": vendor, "cust": cust, "monkeypatch": monkeypatch}


def _pay_mock(e, bid, kind="advance"):
    c, h = e["client"], e["h"]
    o = c.post("/api/payments/create-order", json={"booking_id": bid, "kind": kind, "method": "upi"}, headers=h)
    assert o.status_code == 200, o.text
    v = c.post("/api/payments/verify", json={"booking_id": bid, "kind": kind, "razorpay_order_id": o.json()["order_id"],
                                            "razorpay_payment_id": "pay_mock_1", "razorpay_signature": "mock", "method": "upi"}, headers=h)
    assert v.status_code == 200, v.text
    return o.json(), v.json()


def test_mock_order_amounts_and_verify(env):
    bid = env["booking"]()
    order, ver = _pay_mock(env, bid)
    # ₹1,00,000 service + 5% GST = ₹1,05,000; 20% advance = ₹21,000
    assert order["mode"] == "mock" and order["amount"] == 21000 * 100
    assert order["total"] == 105000 and order["advance_amount"] == 21000 and order["balance_amount"] == 84000
    assert ver["success"] and ver["kind"] == "advance" and ver["method"] == "upi"
    b = env["get"](bid)
    assert b["status"] == "booked" and b["advance_paid"] is True and b["payment_status"] == "advance_paid"
    again = env["client"].post("/api/payments/verify", json={"booking_id": bid, "razorpay_order_id": order["order_id"],
                               "razorpay_payment_id": "x", "razorpay_signature": "x"}, headers=env["h"]).json()
    assert again["already_paid"] is True


def test_advance_blocked_until_partner_accepts(env):
    bid = env["booking"](status="pending")
    r = env["client"].post("/api/payments/create-order", json={"booking_id": bid}, headers=env["h"])
    assert r.status_code == 409


def test_balance_order_only_on_event_day(env):
    bid = env["booking"](days=5)
    _pay_mock(env, bid)
    r = env["client"].post("/api/payments/create-order", json={"booking_id": bid, "kind": "balance"}, headers=env["h"])
    assert r.status_code == 409  # not yet due
    today = env["booking"](days=0)
    _pay_mock(env, today)
    order, ver = _pay_mock(env, today, kind="balance")
    assert order["amount"] == 84000 * 100 and ver["kind"] == "balance"
    assert env["get"](today)["balance_status"] == "paid_in_app"


@pytest.mark.parametrize("days,pct", [(10, 100), (4, 50), (1, 0)])
def test_refund_tiers(env, days, pct):
    bid = env["booking"](days=days)
    _pay_mock(env, bid)
    prev = env["client"].get(f"/api/payments/refund-preview/{bid}", headers=env["h"]).json()
    assert prev["refund_percent"] == pct
    r = env["client"].post("/api/payments/refund", json={"booking_id": bid}, headers=env["h"])
    assert r.status_code == 200, r.text
    b = env["get"](bid)
    assert b["status"] == "cancelled" and b["refund_percent"] == pct
    assert b["refund_amount"] == round(21000 * pct / 100)
    assert b["refund_status"] == ("refunded" if pct else "none")


def test_unpaid_withdraw_has_no_refund(env):
    bid = env["booking"](status="pending")
    r = env["client"].post(f"/api/bookings/{bid}/cancel", headers=env["h"])
    assert r.status_code == 200
    assert env["get"](bid)["refund_status"] == "n/a"


def test_status_pending_then_failed(env):
    bid = env["booking"]()
    o = env["client"].post("/api/payments/create-order", json={"booking_id": bid}, headers=env["h"]).json()
    assert env["client"].get(f"/api/payments/status/{bid}", headers=env["h"]).json()["status"] == "pending"
    env["client"].post("/api/payments/failed", json={"booking_id": bid, "razorpay_order_id": o["order_id"],
                       "reason": "Bank declined"}, headers=env["h"])
    st = env["client"].get(f"/api/payments/status/{bid}", headers=env["h"]).json()
    assert st["status"] == "failed" and st["reason"] == "Bank declined"


# ── Razorpay test mode (fake API) ────────────────────────────────────────────
@pytest.fixture()
def rzp(env):
    mp = env["monkeypatch"]
    fake = FakeRazorpay()
    mp.setattr(server, "PAYMENT_MODE", "razorpay_test")
    mp.setattr(server, "RAZORPAY_KEY_ID", "rzp_test_unit")
    mp.setattr(server, "RAZORPAY_KEY_SECRET", SECRET)
    mp.setattr(server, "RAZORPAY_WEBHOOK_SECRET", "whsec_unit")
    mp.setattr(server, "_rzp_request", fake)
    return fake


def _sig(order_id, payment_id, secret=SECRET):
    return hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def test_razorpay_test_requires_test_key(env):
    env["monkeypatch"].setattr(server, "PAYMENT_MODE", "razorpay_test")
    env["monkeypatch"].setattr(server, "RAZORPAY_KEY_ID", "rzp_live_x")
    env["monkeypatch"].setattr(server, "RAZORPAY_KEY_SECRET", "s")
    bid = env["booking"]()
    r = env["client"].post("/api/payments/create-order", json={"booking_id": bid}, headers=env["h"])
    assert r.status_code == 503


def test_razorpay_order_verify_and_route(env, rzp):
    anyio = pytest.importorskip("anyio")
    anyio.run(env["db"].vendors.update_one, {"id": env["vendor"]["id"]}, {"$set": {"razorpay_account_id": "acc_Unit12345"}})
    bid = env["booking"](days=20)
    o = env["client"].post("/api/payments/create-order", json={"booking_id": bid, "method": "upi"}, headers=env["h"]).json()
    assert o["mode"] == "razorpay_test" and o["razorpay_key_id"] == "rzp_test_unit" and o["route_transfer"] is True
    sent = next(p for m, path, p in rzp.calls if path == "/orders")
    t = sent["transfers"][0]
    assert t["account"] == "acc_Unit12345" and t["amount"] == 2100000 - 210000  # 10% Thara commission
    assert t["on_hold"] == 1 and t["on_hold_until"] > 0
    oid = o["order_id"]
    rzp.payments["pay_Unit1"] = {"id": "pay_Unit1", "order_id": oid, "status": "authorized", "amount": 2100000,
                                 "currency": "INR", "method": "card", "card": {"network": "Visa", "last4": "1111"}}
    bad = env["client"].post("/api/payments/verify", json={"booking_id": bid, "razorpay_order_id": oid,
                             "razorpay_payment_id": "pay_Unit1", "razorpay_signature": "nope"}, headers=env["h"])
    assert bad.status_code == 400
    ok = env["client"].post("/api/payments/verify", json={"booking_id": bid, "razorpay_order_id": oid,
                            "razorpay_payment_id": "pay_Unit1", "razorpay_signature": _sig(oid, "pay_Unit1")}, headers=env["h"])
    assert ok.status_code == 200, ok.text
    assert ok.json()["success"] and ok.json()["method"] == "card"
    assert any(path.endswith("/capture") for _, path, _ in rzp.calls)
    methods = env["client"].get("/api/payments/methods", headers=env["h"]).json()
    assert methods["saved_cards"][0] == {"network": "Visa", "last4": "1111", "issuer": "", "type": ""}
    # 50% tier refund reverses the on-hold transfer and pays the Partner their share of what Thara keeps
    anyio.run(env["db"].bookings.update_one, {"id": bid}, {"$set": {"event_date": _day(4)}})
    env["client"].post("/api/payments/refund", json={"booking_id": bid}, headers=env["h"])
    refund = next(p for m, path, p in rzp.calls if path.endswith("/refund"))
    assert refund["amount"] == 1050000 and refund["reverse_all"] == 1
    b = env["get"](bid)
    assert b["refund_status"] == "refunded" and b["razorpay_refund_id"] == "rfnd_unit1"
    assert any(path == "/transfers" for _, path, _ in rzp.calls)


def test_no_linked_account_skips_transfers(env, rzp):
    bid = env["booking"]()
    o = env["client"].post("/api/payments/create-order", json={"booking_id": bid}, headers=env["h"]).json()
    assert o["route_transfer"] is False
    sent = next(p for m, path, p in rzp.calls if path == "/orders")
    assert "transfers" not in sent


def test_webhook_signature_and_settlement(env, rzp):
    bid = env["booking"]()
    oid = env["client"].post("/api/payments/create-order", json={"booking_id": bid}, headers=env["h"]).json()["order_id"]
    body = json.dumps({"event": "payment.captured", "payload": {"payment": {"entity": {
        "id": "pay_Hook1", "order_id": oid, "status": "captured", "method": "upi"}}}}).encode()
    bad = env["client"].post("/api/payments/webhook", content=body, headers={"X-Razorpay-Signature": "bad"})
    assert bad.status_code == 400
    sig = hmac.new(b"whsec_unit", body, hashlib.sha256).hexdigest()
    hdr = {"X-Razorpay-Signature": sig, "X-Razorpay-Event-Id": "evt_1", "Content-Type": "application/json"}
    r = env["client"].post("/api/payments/webhook", content=body, headers=hdr)
    assert r.status_code == 200 and r.json()["settled"] == "advance"
    assert env["get"](bid)["advance_paid"] is True
    dup = env["client"].post("/api/payments/webhook", content=body, headers=hdr)
    assert dup.json().get("duplicate") is True


def test_build_route_transfers_unit():
    assert server.build_route_transfers({}, 10000, "advance", "2099-01-01", "b1") == []
    t = server.build_route_transfers({"razorpay_account_id": "acc_X1234567"}, 10000, "balance", "2099-01-01", "b1",
                                     commission_pct=15)[0]
    assert t["amount"] == 8500 and "on_hold" not in t
