import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://pro-events-india.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(api, email, password):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def customer_auth(api):
    data = _login(api, "customer.demo@eventpro.in", "Demo@123")
    return {"token": data["token"], "user": data["user"], "headers": {"Authorization": f"Bearer {data['token']}"}}


@pytest.fixture(scope="session")
def vendor_auth(api):
    data = _login(api, "vendor1@eventpro.in", "Vendor@123")
    return {"token": data["token"], "user": data["user"], "headers": {"Authorization": f"Bearer {data['token']}"}}
