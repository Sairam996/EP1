"""Offline tests: unverified is_demo partners appear in listings without a Pro badge."""
import os
import sys
import uuid

import pytest

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:1")
os.environ.setdefault("DB_NAME", "thara_unit")
os.environ.setdefault("JWT_SECRET_KEY", "unit-test-secret")
os.environ.setdefault("ADMIN_SECRET", "unit-admin")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

mongomock_motor = pytest.importorskip("mongomock_motor")
from fastapi.testclient import TestClient  # noqa: E402
import anyio  # noqa: E402
import server  # noqa: E402


def _partner(**extra):
    base = {
        "id": extra.pop("id", str(uuid.uuid4())),
        "name": extra.pop("name", "Test Partner"),
        "category": extra.pop("category", "decor"),
        "city": "Hyderabad",
        "cover": "https://example.com/cover.jpg",
        "gallery": ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
        "description": "A full description that is definitely long enough to list.",
        "starting_price": 10000,
        "price_unit": "per_event",
        "rating": 0,
        "reviews_count": 0,
        "facilities": [],
        "event_types": extra.pop("event_types", ["wedding"]),
        "address": "Jubilee Hills",
        "phone": "",
        "owner_id": None,
        "lat": 17.4,
        "lng": 78.4,
        "locality": "Jubilee Hills",
        "verified": False,
        "is_demo": False,
    }
    base.update(extra)
    return base


@pytest.fixture()
def env(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()[f"t_{uuid.uuid4().hex[:6]}"]
    monkeypatch.setattr(server, "db", db)
    real = _partner(id="real_verified", name="Real Verified Decor", verified=True, rating=4.8)
    demo = _partner(id="demo_shubh-griha", name="Shubh Griha Pravesh Pooja Setup",
                    is_demo=True, verified=False, event_types=["housewarming"], category="planning")
    hidden = _partner(id="unverified_real", name="Hidden Unverified", verified=False, is_demo=False)

    async def seed():
        await db.vendors.insert_many([real, demo, hidden])
        await db.services.insert_many([
            {"id": "svc_real", "vendor_id": "real_verified", "title": "Decor package", "description": "Full mandap"},
            {"id": "svc_demo", "vendor_id": "demo_shubh-griha", "title": "Pooja setup", "description": "Housewarming pooja"},
        ])
    anyio.run(seed)
    return {"client": TestClient(server.app), "db": db}


def test_event_types_include_housewarming():
    assert any(e["id"] == "housewarming" and e["name"] == "Housewarming" for e in server.EVENT_TYPES)


def test_list_includes_demo_unverified_and_real_verified(env):
    data = env["client"].get("/api/vendors?city=Hyderabad").json()
    ids = [v["id"] for v in data]
    assert "demo_shubh-griha" in ids
    assert "real_verified" in ids
    assert "unverified_real" not in ids
    demo = next(v for v in data if v["id"] == "demo_shubh-griha")
    real = next(v for v in data if v["id"] == "real_verified")
    assert demo["verified"] is False
    assert real["verified"] is True


def test_search_and_event_type_and_category(env):
    c = env["client"]
    house = c.get("/api/vendors", params={"event_type": "housewarming"}).json()
    assert [v["id"] for v in house] == ["demo_shubh-griha"]
    assert house[0]["verified"] is False
    q = c.get("/api/vendors", params={"q": "Shubh"}).json()
    assert any(v["id"] == "demo_shubh-griha" for v in q)
    cat = c.get("/api/vendors", params={"category": "planning"}).json()
    assert any(v["id"] == "demo_shubh-griha" for v in cat)


def test_similar_includes_demo(env):
    data = env["client"].get("/api/vendors/real_verified/similar").json()
    # different category, so empty — add a same-category demo
    async def add():
        await env["db"].vendors.insert_one(_partner(
            id="demo_neelambari", name="Neelambari Mandap & Florals",
            is_demo=True, verified=False, category="decor"))
    anyio.run(add)
    data = env["client"].get("/api/vendors/real_verified/similar").json()
    ids = [v["id"] for v in data]
    assert "demo_neelambari" in ids
    assert all(v["id"] != "real_verified" for v in data)
    assert next(v for v in data if v["id"] == "demo_neelambari")["verified"] is False
