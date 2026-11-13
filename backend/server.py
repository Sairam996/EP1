"""Thara backend — Indian D2C marketplace for event services."""
import os
import uuid
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Literal

import math
import hmac
import hashlib
import re
import secrets
import string
import json as json_mod
import time
from collections import defaultdict, deque
from urllib.parse import urlparse
from cryptography.fernet import Fernet, InvalidToken
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, WebSocket, WebSocketDisconnect, UploadFile, File, Request, Header
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError
from notifications import (send_push, send_email, register_device,
    tpl_welcome, tpl_login_alert, tpl_booking_created_customer, tpl_booking_new_vendor,
    tpl_booking_status, tpl_payment_receipt, tpl_review_received)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("thara")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# ── Config ───────────────────────────────────────────────────────────────────
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET_KEY"]
JWT_ALG = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_MIN = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
PAYMENT_MODE = os.environ.get("PAYMENT_MODE", "mock")
ADMIN_SECRET = os.environ.get("ADMIN_SECRET", "")
KYC_ENCRYPTION_KEY = os.environ.get("KYC_ENCRYPTION_KEY", "")
ENABLE_DEMO_SEED = os.environ.get("ENABLE_DEMO_SEED", "false").lower() == "true"
CORS_ORIGINS = [o.strip() for o in os.environ.get(
    "CORS_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081,http://localhost:19006,http://127.0.0.1:19006"
).split(",") if o.strip() and o.strip() != "*"]
GST_RATE = 0.05
ADVANCE_RATE = 0.20
CANCELLATION_POLICY = {
    "full_refund_after_hours": 7 * 24,   # > 7 days before event
    "half_refund_after_hours": 48,       # 2–7 days
    "summary": "The 20% advance is refunded in full if you cancel more than 7 days before the event. "
               "50% of the advance is refunded between 2 and 7 days. No refund of the advance within 48 hours of the event. "
               "The remaining 80% is due on the event date, in the app or directly to the partner. "
               "Unpaid requests can be withdrawn at any time.",
}

def _is_dev_mode() -> bool:
    return ENABLE_DEMO_SEED or (PAYMENT_MODE or "mock") == "mock"

def _init_kyc_fernet():
    """Use KYC_ENCRYPTION_KEY when set. In demo/mock, auto-generate and persist a local dev key.
    Production (non-mock, demo seed off) stays strict: no key means KYC submit is unavailable."""
    key = (KYC_ENCRYPTION_KEY or "").strip()
    if key:
        return Fernet(key.encode())
    if not _is_dev_mode():
        return None
    key_path = ROOT_DIR / ".kyc_dev_key"
    try:
        if key_path.exists():
            stored = key_path.read_text().strip()
            if stored:
                return Fernet(stored.encode())
        generated = Fernet.generate_key().decode()
        key_path.write_text(generated + "\n")
        logger.info("Generated dev KYC encryption key at %s", key_path)
        return Fernet(generated.encode())
    except Exception as e:
        logger.warning("Could not persist dev KYC key (%s); using an in-process key", e)
        return Fernet(Fernet.generate_key())

_fernet = _init_kyc_fernet()
KYC_SECRET_FIELDS = ("pan_number", "gst_number", "document_url")

def kyc_encrypt(val: str) -> str:
    if not _fernet: raise HTTPException(503, "KYC encryption is not configured (set KYC_ENCRYPTION_KEY)")
    return _fernet.encrypt(val.encode()).decode() if val else ""

def kyc_decrypt(val: str) -> str:
    if not val or not _fernet: return ""
    try: return _fernet.decrypt(val.encode()).decode()
    except InvalidToken: return ""

def _mask(v: str) -> str:
    return ("•" * max(0, len(v) - 4) + v[-4:]) if v else ""

# Simple in-memory sliding-window rate limiter (per process).
_rl_hits: dict = defaultdict(deque)
def rate_limit(key: str, limit: int, window: int = 60):
    now = time.monotonic(); q = _rl_hits[key]
    while q and now - q[0] > window: q.popleft()
    if len(q) >= limit: raise HTTPException(429, "Too many requests, please slow down")
    q.append(now)

def _ip(request) -> str:
    return request.client.host if request and request.client else "unknown"

BACKEND_URL = os.environ.get("BACKEND_URL", "").rstrip("/")
UPLOAD_DIR = ROOT_DIR / "uploads"
try:
    UPLOAD_DIR.mkdir(exist_ok=True)
    if not os.access(UPLOAD_DIR, os.W_OK): raise OSError("read-only")
except OSError:
    # Serverless (e.g. Vercel) bundles are read-only; use /tmp as a local cache.
    # The durable copy of every upload lives in Mongo (db.media), see upload_image.
    UPLOAD_DIR = Path("/tmp/thara-uploads"); UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_MAX_BYTES = 5 * 1024 * 1024
UPLOAD_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

# ── DB ───────────────────────────────────────────────────────────────────────
mongo = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=int(os.environ.get("MONGO_TIMEOUT_MS", "10000")))
db = mongo[DB_NAME]

# ── Auth ─────────────────────────────────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def hash_pw(p: str) -> str: return pwd_ctx.hash(p)
def verify_pw(p: str, h: str) -> bool:
    try: return pwd_ctx.verify(p, h)
    except Exception: return False

def make_token(uid: str, role: str) -> str:
    payload = {"sub": uid, "role": role, "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MIN)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(token: Optional[str] = Depends(oauth2)) -> dict:
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": data["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

def require_role(*roles: str):
    async def dep(u: dict = Depends(get_current_user)) -> dict:
        if u["role"] not in roles:
            raise HTTPException(403, "Forbidden")
        return u
    return dep

# ── Models ───────────────────────────────────────────────────────────────────
Role = Literal["customer", "vendor"]

class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str = Field(min_length=6)
    role: Role = "customer"
    city: Optional[str] = "Hyderabad"

class LoginIn(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str

class OtpSendIn(BaseModel):
    phone: str = Field(min_length=8, max_length=20)

class OtpVerifyIn(BaseModel):
    phone: str = Field(min_length=8, max_length=20)
    otp: str = Field(min_length=4, max_length=8)

class CompleteProfileIn(BaseModel):
    email: Optional[EmailStr] = None
    name: str = Field(min_length=2, max_length=80)
    city: Optional[str] = "Hyderabad"
    role: Role = "customer"
    avatar: Optional[str] = None

class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: str
    role: Role
    city: Optional[str] = None
    vendor_id: Optional[str] = None
    avatar: Optional[str] = None
    profile_complete: Optional[bool] = None

class AuthOut(BaseModel):
    token: str
    user: UserOut

class VendorOut(BaseModel):
    id: str
    name: str
    category: str
    city: str
    cover: str
    gallery: List[str]
    description: str
    starting_price: int
    rating: float
    reviews_count: int
    distance_km: float = 0.0
    verified: bool = False
    facilities: List[str] = []
    event_types: List[str] = []
    address: str = ""
    phone: str = ""
    instagram_url: Optional[str] = ""
    facebook_url: Optional[str] = ""
    website_url: Optional[str] = ""
    owner_id: Optional[str] = None

class BookingIn(BaseModel):
    vendor_id: str
    event_type: str
    event_date: str  # YYYY-MM-DD
    guests: int = 100
    notes: str = ""
    amount: int  # in INR (ignored when service_id given — server uses package price)
    service_id: Optional[str] = None

class BookingOut(BaseModel):
    id: str
    vendor_id: str
    vendor_name: str
    vendor_cover: str
    customer_id: str
    customer_name: str
    event_type: str
    event_date: str
    guests: int
    notes: str
    amount: int
    status: str
    payment_status: str
    created_at: str

class ReviewIn(BaseModel):
    vendor_id: str
    booking_id: Optional[str] = None
    rating: int = Field(ge=1, le=5)
    comment: str = ""

class ChatMsgIn(BaseModel):
    booking_id: str
    text: str

class RegisterPushIn(BaseModel):
    user_id: Optional[str] = None  # ignored; authenticated user is used
    platform: str
    device_token: str

class AIChatIn(BaseModel):
    conversation_id: Optional[str] = None
    message: str

class PayOrderIn(BaseModel):
    booking_id: str
    redeem_points: int = 0
    kind: Literal["advance", "balance"] = "advance"

class ApplyReferralIn(BaseModel):
    code: str

class PayVerifyIn(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    kind: Literal["advance", "balance"] = "advance"

class KycIn(BaseModel):
    business_name: str
    gst_number: str = ""
    pan_number: str
    address: str
    document_url: str = ""

class ServiceIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=2000)
    price: int = Field(ge=0)
    photos: List[str] = Field(default_factory=list, max_length=15)
    instagram_url: Optional[str] = Field(default="", max_length=300)
    facebook_url: Optional[str] = Field(default="", max_length=300)
    website_url: Optional[str] = Field(default="", max_length=300)

class ServicePatch(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    price: Optional[int] = Field(default=None, ge=0)
    photos: Optional[List[str]] = Field(default=None, max_length=15)
    instagram_url: Optional[str] = Field(default=None, max_length=300)
    facebook_url: Optional[str] = Field(default=None, max_length=300)
    website_url: Optional[str] = Field(default=None, max_length=300)

class VendorPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    category: Optional[Literal["venues", "catering", "photography", "decor", "music", "planning"]] = None
    city: Optional[str] = None
    locality: Optional[str] = Field(default=None, max_length=120)
    cover: Optional[str] = None
    gallery: Optional[List[str]] = Field(default=None, max_length=30)
    description: Optional[str] = Field(default=None, max_length=3000)
    starting_price: Optional[int] = Field(default=None, ge=0)
    facilities: Optional[List[str]] = None
    event_types: Optional[List[str]] = None
    address: Optional[str] = Field(default=None, max_length=300)
    phone: Optional[str] = Field(default=None, max_length=20)
    instagram_url: Optional[str] = Field(default=None, max_length=300)
    facebook_url: Optional[str] = Field(default=None, max_length=300)
    website_url: Optional[str] = Field(default=None, max_length=300)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)

class AvailabilityIn(BaseModel):
    blocked_dates: List[str] = []
    max_per_day: int = Field(default=1, ge=1, le=50)

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="Thara API")
api = APIRouter(prefix="/api")

# Uploaded images: served from local disk when present, else from Mongo (db.media),
# so they survive serverless instances that don't share a filesystem.
async def _serve_media(name: str):
    from fastapi.responses import FileResponse, Response
    if not re.fullmatch(r"[0-9a-f]{32}\.(jpg|png|webp)", name or ""):
        raise HTTPException(404, "Not found")
    f = UPLOAD_DIR / name
    if f.is_file():
        return FileResponse(str(f))
    doc = await db.media.find_one({"file": name}, {"_id": 0, "data": 1, "content_type": 1})
    if not doc: raise HTTPException(404, "Not found")
    return Response(content=bytes(doc["data"]), media_type=doc.get("content_type") or "image/jpeg",
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})

@app.get("/uploads/{name}", include_in_schema=False)
async def media_legacy(name: str): return await _serve_media(name)

# Also reachable under /api/media/* for ingress setups that only route /api to the backend.
@app.get("/api/media/{name}", include_in_schema=False)
async def media_api(name: str): return await _serve_media(name)

app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# ── Constants ────────────────────────────────────────────────────────────────
EVENT_TYPES = [
    {"id": "wedding", "name": "Wedding", "icon": "heart"},
    {"id": "sangeet", "name": "Sangeet", "icon": "musical-notes"},
    {"id": "haldi", "name": "Haldi", "icon": "flower"},
    {"id": "mehendi", "name": "Mehendi", "icon": "leaf"},
    {"id": "reception", "name": "Reception", "icon": "wine"},
    {"id": "birthday", "name": "Birthday", "icon": "gift"},
    {"id": "corporate", "name": "Corporate", "icon": "briefcase"},
    {"id": "anniversary", "name": "Anniversary", "icon": "rose"},
    {"id": "engagement", "name": "Engagement", "icon": "diamond"},
    {"id": "baby_shower", "name": "Baby Shower", "icon": "happy"},
]
CATEGORIES = [
    {"id": "venues", "name": "Venues", "icon": "business"},
    {"id": "catering", "name": "Catering", "icon": "restaurant"},
    {"id": "photography", "name": "Photography", "icon": "camera"},
    {"id": "decor", "name": "Decor", "icon": "color-palette"},
    {"id": "music", "name": "Music & DJ", "icon": "musical-note"},
    {"id": "planning", "name": "Event Planning", "icon": "calendar"},
]
CITIES = ["Hyderabad", "Mumbai", "Delhi", "Bangalore", "Chennai", "Pune"]
CITY_COORDS = {
    "Hyderabad": (17.3850, 78.4867), "Mumbai": (19.0760, 72.8777),
    "Delhi": (28.6139, 77.2090),    "Bangalore": (12.9716, 77.5946),
    "Chennai": (13.0827, 80.2707),  "Pune": (18.5204, 73.8567),
}

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1); dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1) * math.cos(p2) * math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def gen_referral_code() -> str:
    return "EP" + "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))

# ── Endpoints ────────────────────────────────────────────────────────────────
@api.get("/")
async def root(): return {"ok": True, "service": "Thara API"}

@api.get("/health")
async def health(): return {"ok": True, "service": "Thara API"}

@api.get("/health/db")
async def health_db():
    try:
        await db.command("ping")
        return {"ok": True, "db": "connected"}
    except Exception as e:
        logger.error(f"DB ping failed: {type(e).__name__}")
        raise HTTPException(503, f"Database unreachable ({type(e).__name__})")

@api.get("/event-types") 
async def get_event_types(): return EVENT_TYPES

@api.get("/categories")
async def get_categories(): return CATEGORIES

@api.get("/cities")
async def get_cities(): return CITIES

@api.post("/register-push", status_code=201)
async def api_register_push(body: RegisterPushIn, u: dict = Depends(get_current_user)):
    await register_device(u["id"], body.platform, body.device_token)
    return {"status": "registered"}

# --- Auth ---
# OTP store in Mongo (db.otp_codes) so send/verify work across serverless instances.
# Mock SMS for now; production would use Twilio/MSG91.
def _otp_hash(phone: str, code: str) -> str:
    return hmac.new(JWT_SECRET.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()

def _norm_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits:
        return phone.strip()
    if len(digits) == 10:
        return "+91" + digits
    if not phone.strip().startswith("+"):
        return "+" + digits
    return "+" + digits

@api.post("/auth/otp/send")
async def otp_send(body: OtpSendIn, request: Request):
    rate_limit(f"otp-send:{_ip(request)}", 5)
    phone = _norm_phone(body.phone)
    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.otp_codes.update_one({"phone": phone}, {"$set": {
        "phone": phone, "code_hash": _otp_hash(phone, code),
        "expires": time.time() + 300, "attempts": 0,
    }}, upsert=True)
    # Mock SMS — log OTP; no Twilio wired yet.
    logger.info(f"[OTP mock] phone={phone} code={code}")
    out = {"status": "sent", "phone": phone, "expires_in": 300}
    # Surface OTP in non-production so Expo can be tested without SMS.
    if os.environ.get("PAYMENT_MODE", "mock") == "mock" or os.environ.get("ENABLE_DEMO_SEED", "false").lower() == "true":
        out["dev_otp"] = code
    return out

@api.post("/auth/otp/verify", response_model=AuthOut)
async def otp_verify(body: OtpVerifyIn, request: Request):
    rate_limit(f"otp-verify:{_ip(request)}", 10)
    phone = _norm_phone(body.phone)
    entry = await db.otp_codes.find_one({"phone": phone})
    if not entry or time.time() > entry["expires"]:
        await db.otp_codes.delete_many({"phone": phone})
        raise HTTPException(400, "OTP expired. Request a new code.")
    await db.otp_codes.update_one({"phone": phone}, {"$inc": {"attempts": 1}})
    if entry.get("attempts", 0) + 1 > 5:
        await db.otp_codes.delete_many({"phone": phone})
        raise HTTPException(429, "Too many OTP attempts")
    if not hmac.compare_digest(_otp_hash(phone, body.otp.strip()), entry.get("code_hash", "")):
        raise HTTPException(401, "Invalid OTP")
    await db.otp_codes.delete_many({"phone": phone})

    # Find existing user by phone variants
    variants = {phone, phone.lstrip("+"), phone[-10:] if len(phone) >= 10 else phone}
    digits = "".join(ch for ch in phone if ch.isdigit())
    if digits:
        variants.add(digits)
        variants.add("+" + digits)
        if len(digits) == 10:
            variants.add("+91" + digits)
    u = await db.users.find_one({"phone": {"$in": list(variants)}})
    if not u:
        uid = str(uuid.uuid4())
        doc = {
            "id": uid,
            "name": "",
            "email": f"{digits}@phone.thara.app",
            "phone": phone,
            "password_hash": hash_pw(secrets.token_urlsafe(16)),
            "role": "customer",
            "city": "Hyderabad",
            "referral_code": gen_referral_code(),
            "points": 0,
            "profile_complete": False,
            "avatar": "https://ui-avatars.com/api/?name=Thara&background=D4AF37&color=0B0C10",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(doc)
        u = doc
    token = make_token(u["id"], u.get("role", "customer"))
    return {"token": token, "user": {
        "id": u["id"], "name": u.get("name") or "", "email": u["email"], "phone": u["phone"],
        "role": u.get("role", "customer"), "city": u.get("city"), "vendor_id": u.get("vendor_id"),
        "avatar": u.get("avatar"),
        "profile_complete": bool(u.get("profile_complete")) or bool(u.get("name")),
    }}

@api.post("/auth/complete-profile", response_model=UserOut)
async def complete_profile(body: CompleteProfileIn, u: dict = Depends(get_current_user)):
    updates = {
        "name": body.name.strip(),
        "city": body.city or "Hyderabad",
        "profile_complete": True,
        "avatar": body.avatar or f"https://ui-avatars.com/api/?name={body.name.strip().replace(' ','+')}&background=D4AF37&color=0B0C10",
    }
    if body.email:
        existing = await db.users.find_one({"email": body.email.lower(), "id": {"$ne": u["id"]}})
        if existing:
            raise HTTPException(400, "Email already registered")
        updates["email"] = body.email.lower()
    # Role upgrade to vendor if requested and not already
    if body.role == "vendor" and u.get("role") != "vendor":
        vid = str(uuid.uuid4())
        updates["role"] = "vendor"
        updates["vendor_id"] = vid
        clat, clng = CITY_COORDS.get(body.city or "Hyderabad", (17.3850, 78.4867))
        await db.vendors.insert_one({
            "id": vid, "owner_id": u["id"], "name": body.name.strip() + " Services",
            "category": "venues", "city": body.city or "Hyderabad",
            "cover": "https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg",
            "gallery": ["https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg"],
            "description": "New partner on Thara.", "starting_price": 50000, "cover_is_placeholder": True,
            "rating": 0.0, "reviews_count": 0, "seed_rating": 0.0, "seed_reviews_count": 0, "verified": False,
            "facilities": [], "event_types": ["wedding"], "address": body.city or "",
            "phone": u.get("phone", ""), "lat": clat, "lng": clng,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await db.users.update_one({"id": u["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": u["id"]})
    return {
        "id": fresh["id"], "name": fresh["name"], "email": fresh["email"], "phone": fresh["phone"],
        "role": fresh["role"], "city": fresh.get("city"), "vendor_id": fresh.get("vendor_id"),
        "avatar": fresh.get("avatar"),
        "profile_complete": bool(fresh.get("profile_complete", True)),
    }

@api.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn, request: Request):
    rate_limit(f"register:{_ip(request)}", 5)
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email already registered")
    if body.phone and await db.users.find_one({"phone": body.phone.strip()}):
        raise HTTPException(400, "Phone already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "name": body.name, "email": body.email.lower(), "phone": body.phone,
        "password_hash": hash_pw(body.password), "role": body.role, "city": body.city,
        "referral_code": gen_referral_code(), "points": 0,
        "avatar": f"https://ui-avatars.com/api/?name={body.name.replace(' ','+')}&background=D4AF37&color=0B0C10",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.role == "vendor":
        vid = str(uuid.uuid4())
        doc["vendor_id"] = vid
        clat, clng = CITY_COORDS.get(body.city or "Hyderabad", (17.3850, 78.4867))
        await db.vendors.insert_one({
            "id": vid, "owner_id": uid, "name": body.name + " Services",
            "category": "venues", "city": body.city or "Hyderabad",
            "cover": "https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg",
            "gallery": ["https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg"],
            "description": "New partner on Thara.", "starting_price": 50000, "cover_is_placeholder": True,
            "rating": 0.0, "reviews_count": 0, "seed_rating": 0.0, "seed_reviews_count": 0, "verified": False,
            "facilities": [], "event_types": ["wedding"], "address": body.city or "",
            "phone": body.phone, "lat": clat, "lng": clng,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await db.users.insert_one(doc)
    token = make_token(uid, body.role)
    user = {k: v for k, v in doc.items() if k != "password_hash" and k != "created_at"}
    # Welcome email (mocked when RESEND_API_KEY is empty).
    try:
        subj, html, preview = tpl_welcome(body.name)
        await send_email(to=body.email.lower(), subject=subj, html=html, preview=preview)
    except Exception as e:
        logger.warning(f"Welcome email dispatch failed (non-blocking): {e}")
    return {"token": token, "user": user}

@api.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn, request: Request):
    rate_limit(f"login:{_ip(request)}", 10)
    email = (body.email or "").strip().lower() if body.email else ""
    phone = (body.phone or "").strip() if body.phone else ""
    if not email and not phone:
        raise HTTPException(400, "Email or phone is required")
    u = None
    if email:
        u = await db.users.find_one({"email": email})
    if not u and phone:
        # Match exact phone or common +91 / 0-prefix variants
        variants = {phone}
        digits = "".join(ch for ch in phone if ch.isdigit())
        if digits:
            variants.add(digits)
            variants.add("+" + digits)
            if digits.startswith("91") and len(digits) >= 12:
                variants.add("+" + digits)
                variants.add(digits[-10:])
            elif len(digits) == 10:
                variants.add("+91" + digits)
                variants.add("91" + digits)
        u = await db.users.find_one({"phone": {"$in": list(variants)}})
    if not u or not verify_pw(body.password, u["password_hash"]):
        raise HTTPException(401, "Invalid phone/email or password")
    try:
        subj, html, preview = tpl_login_alert(u["name"])
        await send_email(u["email"], subj, html, preview)
    except Exception as e: logger.warning(f"login notify failed: {e}")
    token = make_token(u["id"], u["role"])
    return {"token": token, "user": {
        "id": u["id"], "name": u["name"], "email": u["email"], "phone": u["phone"],
        "role": u["role"], "city": u.get("city"), "vendor_id": u.get("vendor_id"),
        "avatar": u.get("avatar"),
    }}

@api.get("/auth/me", response_model=UserOut)
async def me(u: dict = Depends(get_current_user)):
    return {"id": u["id"], "name": u["name"], "email": u["email"], "phone": u["phone"],
            "role": u["role"], "city": u.get("city"), "vendor_id": u.get("vendor_id"),
            "avatar": u.get("avatar")}


# ── Social / portfolio links ─────────────────────────────────────────────────
def _assert_safe_url_input(s: str):
    if len(s) > 300:
        raise HTTPException(422, "Link is too long")
    low = s.strip().lower()
    if re.match(r"^(javascript|data|file|vbscript|about):", low):
        raise HTTPException(422, "Invalid link")
    if any(ch.isspace() for ch in s.strip()):
        raise HTTPException(422, "Invalid link")

def normalize_instagram(raw: Optional[str]) -> str:
    s = (raw or "").strip()
    if not s:
        return ""
    _assert_safe_url_input(s)
    m = re.search(r"(?:https?://)?(?:www\.)?(?:instagram\.com|instagr\.am)/(.+)$", s, re.I)
    if m:
        path = m.group(1).split("?")[0].strip("/")
        parts = [p for p in path.split("/") if p]
        if not parts:
            raise HTTPException(422, "Enter a valid Instagram handle or URL")
        if parts[0].lower() in ("p", "reel", "reels", "stories") and len(parts) >= 2:
            kind = "reel" if parts[0].lower() in ("reel", "reels") else parts[0].lower()
            return f"https://www.instagram.com/{kind}/{parts[1]}"
        handle = parts[0]
    else:
        handle = s[1:] if s.startswith("@") else s
        handle = handle.strip().strip("/")
    if not re.fullmatch(r"[A-Za-z0-9._]{1,30}", handle):
        raise HTTPException(422, "Enter a valid Instagram handle or URL")
    return f"https://www.instagram.com/{handle}"

def normalize_facebook(raw: Optional[str]) -> str:
    s = (raw or "").strip()
    if not s:
        return ""
    _assert_safe_url_input(s)
    m = re.search(r"(?:https?://)?(?:www\.|m\.)?(?:facebook\.com|fb\.com|fb\.me)/(.+)$", s, re.I)
    if m:
        rest = m.group(1)
        idm = re.search(r"profile\.php\?id=(\d+)", rest, re.I)
        if idm:
            return f"https://www.facebook.com/profile.php?id={idm.group(1)}"
        path = rest.split("?")[0].strip("/")
        if not path or not re.fullmatch(r"[A-Za-z0-9._\-/]+", path) or len(path) > 200:
            raise HTTPException(422, "Enter a valid Facebook page name or URL")
        return f"https://www.facebook.com/{path}"
    handle = s[1:] if s.startswith("@") else s
    handle = handle.strip().strip("/")
    if not re.fullmatch(r"[A-Za-z0-9.]{1,60}", handle):
        raise HTTPException(422, "Enter a valid Facebook page name or URL")
    return f"https://www.facebook.com/{handle}"

def normalize_website(raw: Optional[str]) -> str:
    s = (raw or "").strip()
    if not s:
        return ""
    _assert_safe_url_input(s)
    if re.match(r"^https?://", s, re.I):
        if s.lower().startswith("http://"):
            s = "https://" + s[7:]
    else:
        s = "https://" + s.lstrip("/")
    parsed = urlparse(s)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host or "." not in host:
        raise HTTPException(422, "Enter a valid website URL")
    if not re.fullmatch(r"[A-Za-z0-9.-]+", host):
        raise HTTPException(422, "Enter a valid website URL")
    return s

def apply_social_links(upd: dict) -> dict:
    """Normalize instagram/facebook/website fields in place. Empty string clears the link."""
    if "instagram_url" in upd:
        upd["instagram_url"] = normalize_instagram(upd.get("instagram_url"))
    if "facebook_url" in upd:
        upd["facebook_url"] = normalize_facebook(upd.get("facebook_url"))
    if "website_url" in upd:
        upd["website_url"] = normalize_website(upd.get("website_url"))
    return upd


def _service_pub(s: dict, category: str = "") -> dict:
    if not s: return s
    out = dict(s)
    out.pop("_id", None)
    for f in ("instagram_url", "facebook_url", "website_url"):
        out[f] = out.get(f) or ""
    out["price_unit"] = s.get("price_unit") or price_unit_for(category)
    return out

def _demo_social_links(name: str, i: int) -> dict:
    """Example portfolio links for seeded demo vendors. Some are intentionally partial or empty."""
    slug = re.sub(r"[^a-z0-9]+", "", (name or "").lower())[:22] or f"vendor{i+1}"
    if i % 8 == 7:
        return {}
    links = {
        "instagram_url": f"https://www.instagram.com/{slug}",
        "facebook_url": f"https://www.facebook.com/{slug}",
        "website_url": f"https://www.{slug}.in",
    }
    if i % 5 == 4:
        links.pop("facebook_url", None)
    return links

def price_unit_for(category: Optional[str]) -> str:
    return "per_plate" if category == "catering" else "per_event"


def _merged_rating(v: dict, real_revs: Optional[List[dict]] = None) -> tuple:
    """Blend seeded baseline rating/count with real reviews so a first review cannot jump 4.8/33 → 5.0/1."""
    seed_n = int(v.get("seed_reviews_count") or 0)
    seed_r = float(v.get("seed_rating") if v.get("seed_rating") is not None else 0)
    revs = real_revs if real_revs is not None else []
    real_n = len(revs)
    real_sum = sum(float(r.get("rating") or 0) for r in revs)
    total_n = seed_n + real_n
    if total_n <= 0:
        return 0.0, 0
    avg = (seed_r * seed_n + real_sum) / total_n
    return round(avg, 1), total_n


IST = timezone(timedelta(hours=5, minutes=30))


def _hours_until_event(event_date: str) -> float:
    ev = datetime.strptime(event_date, "%Y-%m-%d").replace(tzinfo=IST)
    return (ev - datetime.now(IST)).total_seconds() / 3600.0


def compute_totals(service_amount: int) -> dict:
    """Service + 5% GST; advance is 20% of that total, rounded to the nearest rupee."""
    service = max(0, int(service_amount or 0))
    gst = int(round(service * GST_RATE))
    total = service + gst
    advance = int(round(total * ADVANCE_RATE))
    balance = max(0, total - advance)
    return {
        "service": service, "gst_rate": GST_RATE, "gst": gst,
        "subtotal": total, "total": total,
        "advance_amount": advance, "balance_amount": balance,
        "currency": "INR",
    }


def compute_price_breakdown(service_amount: int, redeem_requested: int, available_points: int,
                            lifetime_points: int = 0, kind: str = "advance") -> dict:
    totals = compute_totals(service_amount)
    service, advance, total = totals["service"], totals["advance_amount"], totals["total"]
    kind = "balance" if kind == "balance" else "advance"
    if kind == "balance":
        max_redeem = 0
        redeemed = 0
        charge = totals["balance_amount"]
    else:
        # Points apply to the advance only: cap at advance and at 20% of service.
        max_redeem = min(max(0, int(available_points or 0)), int(service * 0.20), advance)
        redeemed = min(max(0, int(redeem_requested or 0)), max_redeem)
        charge = max(0, advance - redeemed)
    tier = compute_tier(int(lifetime_points or 0))
    earn = int(round(charge * 0.05 * (1.0 + tier["boost"])))
    return {
        **totals,
        "kind": kind,
        "points_available": int(available_points or 0),
        "max_redeem": max_redeem,
        "points_redeemed": redeemed,
        "charge": charge,
        "advance_due": charge if kind == "advance" else advance,
        "earn_estimate": earn,
        "tier": tier["name"],
        "boost_pct": int(tier["boost"] * 100),
        "cancellation_policy": CANCELLATION_POLICY["summary"],
    }


def _event_reached(event_date: str) -> bool:
    return _hours_until_event(event_date or "2099-01-01") <= 0


def _advance_is_paid(b: dict) -> bool:
    return bool(b.get("advance_paid")) or b.get("status") == "booked" or b.get("payment_status") in ("advance_paid", "paid")


def _balance_settled(b: dict) -> bool:
    return b.get("balance_status") in ("paid_in_app", "paid_offline")


def _display_status(b: dict) -> str:
    st = b.get("status")
    if st == "pending":
        return "Awaiting partner"
    if st == "confirmed":
        return "Awaiting advance"
    if st == "booked":
        if _balance_settled(b):
            return "Booked"
        if b.get("balance_status") == "claimed_offline":
            return "Balance claimed"
        return "Booked · balance due"
    if st == "completed":
        return "Completed"
    if st == "cancelled":
        return "Cancelled"
    if st == "rejected":
        return "Declined"
    return (st or "").replace("_", " ").title()


def apply_booking_payments(b: dict) -> dict:
    """Fill advance/balance fields; migrate legacy fully-paid bookings."""
    totals = compute_totals(int(b.get("amount") or 0))
    b.setdefault("gst_amount", totals["gst"])
    b.setdefault("total_amount", totals["total"])
    b.setdefault("advance_amount", totals["advance_amount"])
    b.setdefault("balance_amount", totals["balance_amount"])
    if b.get("advance_paid") is None:
        legacy_paid = b.get("payment_status") == "paid"
        if legacy_paid:
            charged = int(b.get("final_amount") or totals["total"])
            b["advance_paid"] = True
            b.setdefault("advance_paid_at", b.get("created_at"))
            b.setdefault("advance_charged", min(charged, int(b["advance_amount"])))
            # Old checkout collected the full GST-inclusive total in one payment.
            if charged >= max(0, totals["total"] - int(b.get("points_redeemed") or 0)) or b.get("status") == "completed":
                b.setdefault("balance_status", "paid_in_app")
                b.setdefault("balance_paid_at", b.get("created_at"))
                b.setdefault("payment_method_balance", "in_app")
            else:
                b.setdefault("balance_status", "due")
            if b.get("status") == "confirmed":
                b["status"] = "booked"
            b["payment_status"] = "paid" if _balance_settled(b) else "advance_paid"
            b.setdefault("payment_method_advance", "in_app")
        else:
            b["advance_paid"] = False
            b.setdefault("balance_status", "due")
    b.setdefault("balance_status", "due")
    return b


def cancel_refund_preview(b: dict) -> dict:
    hours = _hours_until_event(b.get("event_date") or "2099-01-01")
    if hours > 7 * 24:
        pct = 100
        band = "full"
    elif hours >= 48:
        pct = 50
        band = "half"
    else:
        pct = 0
        band = "none"
    paid = _advance_is_paid(b)
    paid_amt = int(b.get("advance_charged") or 0) if paid else 0
    refund = int(round(paid_amt * pct / 100.0)) if paid else 0
    cancellable = b.get("status") in ("pending", "confirmed", "booked") and not _balance_settled(b)
    return {
        "cancellable": cancellable,
        "hours_until_event": round(hours, 1),
        "refund_percent": pct if paid and cancellable else (100 if (cancellable and not paid) else 0),
        "refund_amount": refund if cancellable else 0,
        "band": band,
        "paid": paid,
        "applies_to": "advance",
        "policy": CANCELLATION_POLICY["summary"],
    }


# --- Vendors ---
def _vendor_pub(v: dict, user_city: str = "Hyderabad", user_lat: Optional[float] = None, user_lng: Optional[float] = None) -> dict:
    v_lat = v.get("lat"); v_lng = v.get("lng")
    if user_lat is not None and user_lng is not None and v_lat is not None and v_lng is not None:
        dist = haversine_km(user_lat, user_lng, v_lat, v_lng)
    elif v_lat is not None and v_lng is not None and user_city in CITY_COORDS:
        ulat, ulng = CITY_COORDS[user_city]
        dist = haversine_km(ulat, ulng, v_lat, v_lng)
    else:
        same = v.get("city") == user_city
        dist = None  # unknown — don't fabricate a distance
    if dist is not None and dist < 0.05 and user_lat is None:
        dist = None  # vendor pinned at the default city centre: distance is meaningless
    return {
        "id": v["id"], "name": v["name"], "category": v["category"], "city": v["city"],
        "cover": v["cover"], "gallery": v.get("gallery", []), "description": v["description"],
        "starting_price": v["starting_price"],
        "price_unit": v.get("price_unit") or price_unit_for(v.get("category")),
        "rating": round(float(v.get("rating") or 0), 1),
        "reviews_count": int(v.get("reviews_count") or 0), "distance_km": round(dist, 1) if dist is not None else None,
        "verified": v.get("verified", False), "facilities": v.get("facilities", []),
        "event_types": v.get("event_types", []), "address": v.get("address", ""),
        "phone": v.get("phone", ""), "owner_id": v.get("owner_id"),
        "instagram_url": v.get("instagram_url") or "",
        "facebook_url": v.get("facebook_url") or "",
        "website_url": v.get("website_url") or "",
        "lat": v_lat, "lng": v_lng, "locality": v.get("locality", ""),
        "kyc_status": v.get("kyc_status", "approved" if v.get("verified") else "not_submitted"),
    }

@api.get("/vendors")
async def list_vendors(city: Optional[str] = None, category: Optional[str] = None,
                       event_type: Optional[str] = None, q: Optional[str] = None,
                       trending: Optional[bool] = None, limit: int = 50,
                       lat: Optional[float] = None, lng: Optional[float] = None):
    # Listing gate: only verified vendors with a launch-ready profile are listed.
    query: dict = {"verified": True}
    if city: query["city"] = city
    if category: query["category"] = category
    if event_type: query["event_types"] = event_type
    limit = max(1, min(int(limit), 50))
    # Text search is applied in Python so we can match name, category, description,
    # event types, facilities and package titles — not just vendor name.
    fetch_limit = 200 if q else limit
    cursor = db.vendors.find(query, {"_id": 0})
    if trending:
        cursor = cursor.sort("rating", -1)
    items = await cursor.to_list(fetch_limit)
    if q:
        terms = [t for t in re.split(r"\s+", q.strip().lower()[:100]) if t]
        vids = [v["id"] for v in items]
        svcs = await db.services.find(
            {"vendor_id": {"$in": vids}}, {"_id": 0, "vendor_id": 1, "title": 1, "description": 1}
        ).to_list(2000) if vids else []
        by_v: dict = {}
        for s in svcs:
            by_v.setdefault(s["vendor_id"], []).append(s)
        def _haystack(v: dict) -> str:
            parts = [v.get("name"), v.get("category"), v.get("city"), v.get("description"),
                     *(v.get("facilities") or []), *(v.get("event_types") or [])]
            for s in by_v.get(v["id"], []):
                parts += [s.get("title"), s.get("description")]
            return " ".join(str(x) for x in parts if x).lower()
        items = [v for v in items if all(term in _haystack(v) for term in terms)]
    items = items[:limit]
    svc_counts = await _service_counts([v["id"] for v in items])
    items = [v for v in items if profile_completeness(v, svc_counts.get(v["id"], 0))["listable"]]
    return [_vendor_pub(v, city or "Hyderabad", lat, lng) for v in items]

@api.get("/vendors/{vendor_id}")
async def get_vendor(vendor_id: str, lat: Optional[float] = None, lng: Optional[float] = None):
    v = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not v: raise HTTPException(404, "Partner not found")
    await db.vendors.update_one({"id": vendor_id}, {"$inc": {"views": 1}})
    out = _vendor_pub(v, v.get("city", "Hyderabad"), lat, lng)
    out["founding_vendor"] = bool(v.get("founding_vendor"))
    return out

@api.get("/vendors/{vendor_id}/services")
async def public_vendor_services(vendor_id: str):
    vend = await db.vendors.find_one({"id": vendor_id}, {"_id": 0, "category": 1})
    cat = (vend or {}).get("category") or ""
    items = await db.services.find({"vendor_id": vendor_id}, {"_id": 0}).sort("price", 1).to_list(100)
    return [_service_pub(x, cat) for x in items]

@api.get("/vendors/{vendor_id}/availability")
async def public_vendor_availability(vendor_id: str):
    return await _availability_summary(vendor_id)

@api.get("/vendors/{vendor_id}/similar")
async def similar_vendors(vendor_id: str):
    v = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not v: return []
    items = await db.vendors.find(
        {"category": v["category"], "city": v.get("city"), "id": {"$ne": vendor_id}, "verified": True}, {"_id": 0}
    ).limit(6).to_list(6)
    return [_vendor_pub(x, v.get("city", "Hyderabad")) for x in items]

@api.get("/vendors/{vendor_id}/reviews")
async def vendor_reviews(vendor_id: str):
    items = await db.reviews.find({"vendor_id": vendor_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items

# --- Favorites ---
@api.get("/favorites")
async def list_favs(u: dict = Depends(get_current_user)):
    favs = await db.favorites.find({"user_id": u["id"]}, {"_id": 0}).to_list(200)
    vids = [f["vendor_id"] for f in favs]
    if not vids: return []
    vs = await db.vendors.find({"id": {"$in": vids}}, {"_id": 0}).to_list(200)
    return [_vendor_pub(v, u.get("city", "Hyderabad")) for v in vs]

@api.post("/favorites/{vendor_id}")
async def toggle_fav(vendor_id: str, u: dict = Depends(get_current_user)):
    existing = await db.favorites.find_one({"user_id": u["id"], "vendor_id": vendor_id})
    if existing:
        await db.favorites.delete_one({"user_id": u["id"], "vendor_id": vendor_id})
        return {"favorited": False}
    await db.favorites.insert_one({"user_id": u["id"], "vendor_id": vendor_id,
                                   "created_at": datetime.now(timezone.utc).isoformat()})
    return {"favorited": True}

# --- Bookings ---
async def _enrich_booking(b: dict) -> dict:
    b = apply_booking_payments(dict(b))
    v = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "name": 1, "cover": 1, "category": 1})
    c = await db.users.find_one({"id": b["customer_id"]}, {"_id": 0, "name": 1, "points": 1, "lifetime_points": 1})
    available = int((c or {}).get("points") or 0)
    lifetime = int((c or {}).get("lifetime_points") or 0)
    stored_redeem = int(b.get("points_redeemed") or 0)
    kind = "balance" if _advance_is_paid(b) and not _balance_settled(b) else "advance"
    redeem_for_quote = stored_redeem if _advance_is_paid(b) else 0
    breakdown = compute_price_breakdown(int(b.get("amount") or 0), redeem_for_quote, available, lifetime, kind=kind)
    # Always expose the contractual total (service+GST), not a points-discounted figure.
    breakdown["total"] = int(b.get("total_amount") or breakdown["total"])
    breakdown["advance_amount"] = int(b.get("advance_amount") or breakdown["advance_amount"])
    breakdown["balance_amount"] = int(b.get("balance_amount") or breakdown["balance_amount"])
    if _advance_is_paid(b):
        breakdown["points_redeemed"] = stored_redeem
        breakdown["advance_due"] = 0
        breakdown["charge"] = int(b.get("advance_charged") or 0) if kind == "advance" else breakdown["balance_amount"]
    event_reached = _event_reached(b.get("event_date") or "2099-01-01")
    advance_payable = b.get("status") == "confirmed" and not _advance_is_paid(b)
    balance_payable = b.get("status") == "booked" and b.get("balance_status") == "due" and event_reached
    timeline = [
        {
            "key": "advance",
            "label": "Advance (20%)",
            "amount": int(b.get("advance_amount") or 0),
            "charged": int(b.get("advance_charged") or 0) if _advance_is_paid(b) else None,
            "status": "paid" if _advance_is_paid(b) else ("due" if b.get("status") == "confirmed" else "pending"),
            "at": b.get("advance_paid_at"),
            "method": b.get("payment_method_advance"),
        },
        {
            "key": "balance",
            "label": "Balance (80%)",
            "amount": int(b.get("balance_amount") or 0),
            "status": b.get("balance_status") or "due",
            "at": b.get("balance_paid_at") or b.get("balance_claimed_at"),
            "method": b.get("payment_method_balance"),
            "due_on": b.get("event_date"),
            "unlocked": event_reached,
        },
    ]
    return {**b,
            "vendor_name": v["name"] if v else "Partner",
            "vendor_cover": v["cover"] if v else "",
            "customer_name": c["name"] if c else "Customer",
            "price_unit": price_unit_for((v or {}).get("category")),
            "price_breakdown": breakdown,
            "cancel_preview": cancel_refund_preview(b),
            "display_status": _display_status(b),
            "event_reached": event_reached,
            "advance_payable": advance_payable,
            "balance_payable": balance_payable,
            "balance_settled": _balance_settled(b),
            "payment_timeline": timeline}

@api.post("/bookings")
async def create_booking(body: BookingIn, u: dict = Depends(require_role("customer"))):
    v = await db.vendors.find_one({"id": body.vendor_id})
    if not v: raise HTTPException(404, "Partner not found")
    avail = await _availability_summary(body.vendor_id)
    if body.event_date in avail["blocked_dates"]:
        raise HTTPException(409, "This partner is not available on this date")
    if body.event_date in avail["full_dates"]:
        raise HTTPException(409, "This partner is fully booked on this date")
    amount = body.amount
    service_title = None
    if body.service_id:
        svc = await db.services.find_one({"id": body.service_id, "vendor_id": body.vendor_id}, {"_id": 0})
        if not svc: raise HTTPException(404, "Package not found")
        amount = int(svc["price"]); service_title = svc["title"]
    elif not amount or amount <= 0:
        amount = int(v.get("starting_price", 0))
    body.amount = amount
    bid = str(uuid.uuid4())
    totals = compute_totals(int(body.amount or 0))
    doc = {"id": bid, "vendor_id": body.vendor_id, "customer_id": u["id"],
           "event_type": body.event_type, "event_date": body.event_date,
           "guests": body.guests, "notes": body.notes, "amount": body.amount,
           "service_id": body.service_id, "service_title": service_title,
           "status": "pending", "payment_status": "unpaid",
           "gst_amount": totals["gst"], "total_amount": totals["total"],
           "advance_amount": totals["advance_amount"], "advance_paid": False,
           "balance_amount": totals["balance_amount"], "balance_status": "due",
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.bookings.insert_one(doc.copy())
    # Notify customer + vendor owner
    try:
        v = await db.vendors.find_one({"id": body.vendor_id}, {"_id": 0, "name": 1, "owner_id": 1})
        owner = await db.users.find_one({"id": v.get("owner_id")}, {"_id": 0, "email": 1, "name": 1, "id": 1}) if v else None
        # Customer confirmation
        subj, html, prev = tpl_booking_created_customer(u["name"], v["name"], body.event_type, body.event_date, totals["total"])
        await send_email(u["email"], subj, html, prev)
        await send_push([u["id"]], "Booking request sent",
            f"Waiting for {v['name']} to confirm. A 20% advance (₹{totals['advance_amount']:,}) locks the date.",
            action_url=f"/booking-detail/{bid}")
        # Vendor new-inquiry
        if owner:
            subj2, html2, prev2 = tpl_booking_new_vendor(owner["name"], u["name"], body.event_type, body.event_date, totals["total"])
            await send_email(owner["email"], subj2, html2, prev2)
            await send_push([owner["id"]], f"New inquiry — {u['name']}",
                f"{body.event_type.title()} on {body.event_date} · ₹{totals['total']:,} (20% advance to lock)",
                action_url="/(vendor)/bookings")
    except Exception as e: logger.warning(f"booking notify failed: {e}")
    return await _enrich_booking(doc)

@api.get("/bookings")
async def list_bookings(u: dict = Depends(get_current_user)):
    if u["role"] == "customer":
        q = {"customer_id": u["id"]}
    else:
        q = {"vendor_id": u.get("vendor_id")}
    items = await db.bookings.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [await _enrich_booking(b) for b in items]

@api.get("/bookings/{bid}")
async def get_booking(bid: str, u: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b: raise HTTPException(404, "Booking not found")
    if u["role"] == "customer" and b["customer_id"] != u["id"]:
        raise HTTPException(403, "Forbidden")
    if u["role"] == "vendor" and b["vendor_id"] != u.get("vendor_id"):
        raise HTTPException(403, "Forbidden")
    return await _enrich_booking(b)

@api.patch("/bookings/{bid}/status")
async def update_booking_status(bid: str, status_val: str, u: dict = Depends(require_role("vendor"))):
    if status_val not in ["confirmed", "rejected", "completed", "cancelled"]:
        raise HTTPException(400, "Invalid status")
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b or b["vendor_id"] != u.get("vendor_id"):
        raise HTTPException(404, "Booking not found")
    b = apply_booking_payments(b)
    if status_val == "confirmed" and b.get("status") not in ("pending", "confirmed"):
        raise HTTPException(409, "This booking can no longer be accepted")
    if status_val == "rejected" and b.get("status") not in ("pending", "confirmed"):
        raise HTTPException(409, "This booking can no longer be declined")
    if status_val == "completed":
        # Cleanest: the event is only complete once the 80% balance is settled.
        if b.get("status") != "booked" or not _balance_settled(b):
            raise HTTPException(409, "Mark the balance as received (or have the customer pay it in the app) before completing this booking")
    await db.bookings.update_one({"id": bid}, {"$set": {"status": status_val}})
    b["status"] = status_val
    try:
        cust = await db.users.find_one({"id": b["customer_id"]}, {"_id": 0, "name": 1, "email": 1, "id": 1})
        v = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "name": 1})
        if cust and v and status_val in ("confirmed", "rejected", "completed"):
            adv = int(b.get("advance_amount") or 0)
            bal = int(b.get("balance_amount") or 0)
            subj, html, prev = tpl_booking_status(cust["name"], v["name"], status_val, b["event_date"],
                                                  advance=adv, balance=bal)
            await send_email(cust["email"], subj, html, prev)
            if status_val == "confirmed":
                push_title, push_msg = "Your booking is accepted", f"Pay a 20% advance of ₹{adv:,} to lock {b['event_date']} with {v['name']}."
            elif status_val == "rejected":
                push_title, push_msg = "Your booking was declined", f"{v['name']} · {b['event_date']}"
            else:
                push_title, push_msg = "Your booking is marked completed ✓", f"{v['name']} · {b['event_date']}"
            await send_push([cust["id"]], push_title, push_msg, action_url=f"/booking-detail/{bid}")
    except Exception as e: logger.warning(f"status notify failed: {e}")
    return await _enrich_booking(b)

@api.post("/bookings/{bid}/cancel")
async def cancel_booking(bid: str, u: dict = Depends(require_role("customer"))):
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b or b["customer_id"] != u["id"]:
        raise HTTPException(404, "Booking not found")
    preview = cancel_refund_preview(b)
    if not preview["cancellable"]:
        raise HTTPException(409, "This booking can no longer be cancelled")
    refund_amount = preview["refund_amount"]
    refund_percent = preview["refund_percent"] if preview["paid"] else 0
    upd = {
        "status": "cancelled",
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "cancelled_by": "customer",
        "refund_percent": refund_percent,
        "refund_amount": refund_amount,
        "refund_status": "refunded" if refund_amount > 0 else ("n/a" if not preview["paid"] else "none"),
    }
    if refund_amount > 0:
        # Mock refund — no Razorpay refund call in mock/dev. Live refunds need Razorpay Refunds API + keys.
        upd["payment_status"] = "refunded"
    await db.bookings.update_one({"id": bid}, {"$set": upd})
    b.update(upd)
    try:
        v = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "name": 1, "owner_id": 1})
        owner = await db.users.find_one({"id": (v or {}).get("owner_id")}, {"_id": 0, "email": 1, "name": 1, "id": 1}) if v else None
        if v:
            await send_push([u["id"]], "Booking cancelled",
                (f"₹{refund_amount:,} will be refunded ({refund_percent}%)." if refund_amount else f"Your booking with {v['name']} is cancelled."),
                action_url=f"/booking-detail/{bid}")
        if owner:
            await send_push([owner["id"]], f"{u.get('name') or 'Customer'} cancelled a booking",
                f"{b.get('event_type', 'Event')} on {b.get('event_date')}" + (f" · refund ₹{refund_amount:,}" if refund_amount else ""),
                action_url="/(vendor)/bookings")
    except Exception as e:
        logger.warning(f"cancel notify failed: {e}")
    return await _enrich_booking(b)


@api.post("/bookings/{bid}/balance/claim")
async def claim_balance_offline(bid: str, u: dict = Depends(require_role("customer"))):
    """Customer attests they paid the vendor directly (cash/UPI/bank). Vendor must confirm."""
    b = await db.bookings.find_one({"id": bid, "customer_id": u["id"]}, {"_id": 0})
    if not b: raise HTTPException(404, "Booking not found")
    b = apply_booking_payments(b)
    if b.get("status") != "booked" or not _advance_is_paid(b):
        raise HTTPException(409, "The advance must be paid before the balance can be settled")
    if _balance_settled(b):
        return await _enrich_booking(b)
    if not _event_reached(b.get("event_date") or "2099-01-01"):
        raise HTTPException(409, f"The balance can be settled from {b.get('event_date')} onwards")
    now = datetime.now(timezone.utc).isoformat()
    await db.bookings.update_one({"id": bid}, {"$set": {
        "balance_status": "claimed_offline",
        "balance_claimed_at": now,
        "balance_claimed_by": "customer",
    }})
    try:
        v = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "name": 1, "owner_id": 1})
        owner = await db.users.find_one({"id": (v or {}).get("owner_id")}, {"_id": 0, "id": 1, "name": 1}) if v else None
        if owner:
            await send_push([owner["id"]], f"{u.get('name') or 'Customer'} says the balance is paid",
                f"Confirm if you received ₹{int(b.get('balance_amount') or 0):,} for {b.get('event_date')}.",
                action_url="/(vendor)/bookings")
    except Exception as e:
        logger.warning(f"balance claim notify failed: {e}")
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    return await _enrich_booking(b)


@api.post("/bookings/{bid}/balance/confirm")
async def confirm_balance_offline(bid: str, u: dict = Depends(require_role("vendor"))):
    """Vendor marks the 80% balance received offline. Allowed with or without a customer claim."""
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    if not b or b["vendor_id"] != u.get("vendor_id"):
        raise HTTPException(404, "Booking not found")
    b = apply_booking_payments(b)
    if b.get("status") != "booked" or not _advance_is_paid(b):
        raise HTTPException(409, "The advance must be paid before the balance can be settled")
    if _balance_settled(b):
        return await _enrich_booking(b)
    if not _event_reached(b.get("event_date") or "2099-01-01"):
        raise HTTPException(409, f"The balance can be settled from {b.get('event_date')} onwards")
    now = datetime.now(timezone.utc).isoformat()
    await db.bookings.update_one({"id": bid}, {"$set": {
        "balance_status": "paid_offline",
        "balance_paid_at": now,
        "payment_method_balance": "offline",
        "payment_status": "paid",
        "balance_confirmed_by": "vendor",
    }})
    await db.payments.insert_one({
        "id": str(uuid.uuid4()), "booking_id": bid, "kind": "balance",
        "amount": int(b.get("balance_amount") or 0), "method": "offline",
        "status": "paid", "at": now, "confirmed_by": "vendor",
    })
    try:
        cust = await db.users.find_one({"id": b["customer_id"]}, {"_id": 0, "id": 1, "name": 1, "email": 1})
        v = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "name": 1})
        if cust:
            await send_push([cust["id"]], "Balance received",
                f"{(v or {}).get('name') or 'The partner'} confirmed your balance of ₹{int(b.get('balance_amount') or 0):,}.",
                action_url=f"/booking-detail/{bid}")
    except Exception as e:
        logger.warning(f"balance confirm notify failed: {e}")
    b = await db.bookings.find_one({"id": bid}, {"_id": 0})
    return await _enrich_booking(b)

# --- Reviews ---
@api.post("/reviews")
async def add_review(body: ReviewIn, u: dict = Depends(require_role("customer"))):
    if not body.booking_id: raise HTTPException(400, "booking_id is required to review")
    bk = await db.bookings.find_one({"id": body.booking_id}, {"_id": 0})
    if not bk or bk["customer_id"] != u["id"] or bk["vendor_id"] != body.vendor_id:
        raise HTTPException(403, "You can only review your own bookings")
    if bk.get("status") != "completed":
        raise HTTPException(400, "You can review only after the booking is completed")
    if await db.reviews.find_one({"booking_id": body.booking_id}):
        raise HTTPException(409, "This booking has already been reviewed")
    doc = {"id": str(uuid.uuid4()), "vendor_id": body.vendor_id, "booking_id": body.booking_id,
           "user_id": u["id"], "user_name": u["name"], "user_avatar": u.get("avatar"),
           "rating": body.rating, "comment": body.comment,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.reviews.insert_one(doc.copy())
    # Merge real reviews with the seeded baseline so ratings don't jump from 4.8/33 to 5.0/1.
    vend = await db.vendors.find_one({"id": body.vendor_id}, {"_id": 0})
    revs = await db.reviews.find({"vendor_id": body.vendor_id}, {"_id": 0}).to_list(1000)
    avg, count = _merged_rating(vend or {}, revs)
    await db.vendors.update_one({"id": body.vendor_id},
                                {"$set": {"rating": avg, "reviews_count": count}})
    # Notify vendor
    try:
        v = await db.vendors.find_one({"id": body.vendor_id}, {"_id": 0, "owner_id": 1, "name": 1})
        owner = await db.users.find_one({"id": v.get("owner_id")}, {"_id": 0, "email": 1, "name": 1, "id": 1}) if v else None
        if owner:
            subj, html, prev = tpl_review_received(owner["name"], u["name"], body.rating, body.comment)
            await send_email(owner["email"], subj, html, prev)
            await send_push([owner["id"]], f"{u['name']} left a {body.rating}★ review",
                (body.comment[:80] + "…") if body.comment and len(body.comment) > 80 else (body.comment or "Tap to view"))
    except Exception as e: logger.warning(f"review notify failed: {e}")
    return {k: v for k, v in doc.items()}

# --- Chat (booking threads) ---
@api.get("/chat/threads")
async def chat_threads(u: dict = Depends(get_current_user)):
    if u["role"] == "customer":
        bookings = await db.bookings.find({"customer_id": u["id"]}, {"_id": 0}).to_list(200)
    else:
        bookings = await db.bookings.find({"vendor_id": u.get("vendor_id")}, {"_id": 0}).to_list(200)
    out = []
    for b in bookings:
        last = await db.chat_messages.find({"booking_id": b["id"]}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
        eb = await _enrich_booking(b)
        out.append({"booking_id": b["id"], "vendor_name": eb["vendor_name"],
                    "vendor_cover": eb["vendor_cover"], "customer_name": eb["customer_name"],
                    "last_message": last[0]["text"] if last else "Tap to start the conversation",
                    "last_at": last[0]["created_at"] if last else b["created_at"],
                    "status": b["status"]})
    out.sort(key=lambda x: x["last_at"], reverse=True)
    return out

@api.get("/chat/messages/{bid}")
async def chat_messages(bid: str, u: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": bid})
    if not b: raise HTTPException(404, "Thread not found")
    if u["role"] == "customer" and b["customer_id"] != u["id"]: raise HTTPException(403)
    if u["role"] == "vendor" and b["vendor_id"] != u.get("vendor_id"): raise HTTPException(403)
    msgs = await db.chat_messages.find({"booking_id": bid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return msgs

@api.post("/chat/messages")
async def send_message(body: ChatMsgIn, u: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": body.booking_id})
    if not b: raise HTTPException(404, "Thread not found")
    is_cust = u["role"] == "customer" and b["customer_id"] == u["id"]
    is_vend = u["role"] == "vendor" and b["vendor_id"] == u.get("vendor_id")
    if not (is_cust or is_vend): raise HTTPException(403, "Not a participant of this booking")
    if b.get("status") in ("rejected", "cancelled"):
        raise HTTPException(409, "This conversation is closed")
    doc = {"id": str(uuid.uuid4()), "booking_id": body.booking_id, "sender_id": u["id"],
           "sender_role": u["role"], "sender_name": u["name"], "text": body.text,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.chat_messages.insert_one(doc.copy())
    return doc

# --- AI Chat (Ask AI) ---
@api.post("/ai/chat")
async def ai_chat(body: AIChatIn, u: dict = Depends(get_current_user)):
    cid = body.conversation_id or str(uuid.uuid4())
    convo = await db.ai_conversations.find_one({"id": cid, "user_id": u["id"]}, {"_id": 0})
    history: List[dict] = convo["messages"] if convo else []
    history.append({"role": "user", "content": body.message,
                    "ts": datetime.now(timezone.utc).isoformat()})
    # Call Emergent Universal Key (OpenAI gpt-5.2)
    reply = "I'm here to help plan your perfect event!"
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=cid,
                       system_message=("You are Thara AI, an expert Indian event-planning assistant. "
                                       "Help users plan weddings, sangeet, birthdays, corporate events. "
                                       "Suggest partners, budgets in INR, timelines. Be concise, warm, premium."))
        chat = chat.with_model("openai", "gpt-5.2")
        # Replay last 10 messages for context (the SDK manages session per session_id)
        msg = UserMessage(text=body.message)
        reply = await chat.send_message(msg)
        if not isinstance(reply, str):
            reply = str(reply)
    except Exception as e:
        logger.warning(f"AI error fallback: {e}")
        reply = ("Here are quick tips: 1) Set a budget per category. 2) Lock the venue first. "
                 "3) Book photography & catering 3-6 months ahead. Ask me for partner suggestions in your city!")
    history.append({"role": "assistant", "content": reply,
                    "ts": datetime.now(timezone.utc).isoformat()})
    if convo:
        await db.ai_conversations.update_one({"id": cid}, {"$set": {"messages": history,
                                              "updated_at": datetime.now(timezone.utc).isoformat()}})
    else:
        await db.ai_conversations.insert_one({"id": cid, "user_id": u["id"], "messages": history,
                                              "created_at": datetime.now(timezone.utc).isoformat(),
                                              "updated_at": datetime.now(timezone.utc).isoformat()})
    return {"conversation_id": cid, "reply": reply}

def _verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    if not RAZORPAY_KEY_SECRET:
        return False
    digest = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(digest, (signature or "").strip())


# --- Payments (Razorpay or mock) + Loyalty redeem ---
def _infer_pay_kind(b: dict, requested: str | None = None) -> str:
    if requested in ("advance", "balance"):
        return requested
    if _advance_is_paid(b) and not _balance_settled(b):
        return "balance"
    return "advance"


async def _open_razorpay_order(amount_paise: int, receipt: str) -> tuple[str, bool]:
    live = PAYMENT_MODE == "live" and RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
    if PAYMENT_MODE == "live" and not live:
        raise HTTPException(503, "Razorpay is not configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)")
    if live and amount_paise > 0:
        import razorpay
        rzp = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        order = rzp.order.create({"amount": amount_paise, "currency": "INR",
                                  "receipt": receipt, "payment_capture": 1})
        return order["id"], True
    return f"order_mock_{uuid.uuid4().hex[:14]}", False


async def _award_points(user_id: str, booking_id: str, paid_amt: int) -> tuple[int, dict, bool, int]:
    if paid_amt <= 0:
        cur = await db.users.find_one({"id": user_id}, {"_id": 0, "lifetime_points": 1})
        lifetime = int((cur or {}).get("lifetime_points") or 0)
        tier = compute_tier(lifetime)
        return 0, tier, False, int(tier["boost"] * 100)
    cur_user = await db.users.find_one({"id": user_id}, {"_id": 0, "lifetime_points": 1})
    lifetime_before = int((cur_user or {}).get("lifetime_points", 0))
    tier = compute_tier(lifetime_before)
    earn = int(round(paid_amt * 0.05 * (1.0 + tier["boost"])))
    if earn > 0:
        await db.users.update_one({"id": user_id}, {"$inc": {"points": earn, "lifetime_points": earn}})
        await db.point_history.insert_one({"id": str(uuid.uuid4()), "user_id": user_id,
            "delta": earn, "reason": "earn", "booking_id": booking_id,
            "tier": tier["name"], "boost_pct": int(tier["boost"] * 100),
            "at": datetime.now(timezone.utc).isoformat()})
    new_tier = compute_tier(lifetime_before + earn)
    return earn, new_tier, new_tier["name"] != tier["name"], int(tier["boost"] * 100)


@api.post("/payments/quote")
async def quote_payment(body: PayOrderIn, u: dict = Depends(require_role("customer"))):
    b = await db.bookings.find_one({"id": body.booking_id, "customer_id": u["id"]}, {"_id": 0})
    if not b: raise HTTPException(404, "Booking not found")
    b = apply_booking_payments(b)
    kind = _infer_pay_kind(b, body.kind)
    user = await db.users.find_one({"id": u["id"]}, {"_id": 0, "points": 1, "lifetime_points": 1})
    available = int((user or {}).get("points") or 0)
    lifetime = int((user or {}).get("lifetime_points") or 0)
    redeem = 0 if kind == "balance" else (body.redeem_points or 0)
    bd = compute_price_breakdown(int(b.get("amount") or 0), redeem, available, lifetime, kind=kind)
    event_reached = _event_reached(b.get("event_date") or "2099-01-01")
    if kind == "advance":
        payable = b.get("status") == "confirmed" and not _advance_is_paid(b)
        blocked = None if payable else (
            "Payment of the advance opens after the partner confirms this booking"
            if b.get("status") != "confirmed" else "The advance has already been paid")
    else:
        payable = b.get("status") == "booked" and b.get("balance_status") == "due" and event_reached
        if payable:
            blocked = None
        elif not _advance_is_paid(b):
            blocked = "Pay the 20% advance first"
        elif _balance_settled(b):
            blocked = "The balance has already been settled"
        elif b.get("balance_status") == "claimed_offline":
            blocked = "Waiting for the partner to confirm they received the balance"
        elif not event_reached:
            blocked = f"Due on {b.get('event_date')}"
        else:
            blocked = "Balance is not payable yet"
    return {
        "booking_id": b["id"],
        "status": b.get("status"),
        "payment_status": b.get("payment_status"),
        "display_status": _display_status(b),
        "kind": kind,
        "payable": payable,
        "blocked_reason": blocked,
        "event_date": b.get("event_date"),
        "event_reached": event_reached,
        "mode": PAYMENT_MODE,
        **bd,
    }


@api.post("/payments/order")
async def create_payment_order(body: PayOrderIn, u: dict = Depends(require_role("customer"))):
    b = await db.bookings.find_one({"id": body.booking_id, "customer_id": u["id"]}, {"_id": 0})
    if not b: raise HTTPException(404, "Booking not found")
    b = apply_booking_payments(b)
    kind = _infer_pay_kind(b, body.kind)
    if kind == "advance":
        if _advance_is_paid(b):
            raise HTTPException(409, "The advance has already been paid")
        if b.get("status") != "confirmed":
            raise HTTPException(409, "The 20% advance can be paid after the partner confirms this booking")
    else:
        if _balance_settled(b):
            raise HTTPException(409, "The balance has already been settled")
        if not _advance_is_paid(b) or b.get("status") != "booked":
            raise HTTPException(409, "Pay the 20% advance first")
        if b.get("balance_status") == "claimed_offline":
            raise HTTPException(409, "Waiting for the partner to confirm they received the balance")
        if not _event_reached(b.get("event_date") or "2099-01-01"):
            raise HTTPException(409, f"The balance is due on {b.get('event_date')}")
    user = await db.users.find_one({"id": u["id"]}, {"_id": 0, "points": 1, "lifetime_points": 1})
    available = int((user or {}).get("points") or 0)
    lifetime = int((user or {}).get("lifetime_points") or 0)
    redeem = 0 if kind == "balance" else (body.redeem_points or 0)
    bd = compute_price_breakdown(int(b.get("amount") or 0), redeem, available, lifetime, kind=kind)
    amount_paise = int(bd["charge"]) * 100
    oid, live = await _open_razorpay_order(amount_paise, f"{kind[:3]}_{b['id']}")
    now = datetime.now(timezone.utc).isoformat()
    upd = {
        "gst_amount": bd["gst"],
        "total_amount": bd["total"],
        "advance_amount": bd["advance_amount"],
        "balance_amount": bd["balance_amount"],
    }
    if kind == "advance":
        upd.update({
            "razorpay_order_id": oid,
            "razorpay_advance_order_id": oid,
            "points_redeemed": bd["points_redeemed"],
            "advance_charged": bd["charge"],
        })
    else:
        upd["razorpay_balance_order_id"] = oid
    await db.bookings.update_one({"id": b["id"]}, {"$set": upd})
    await db.payments.insert_one({
        "id": str(uuid.uuid4()), "booking_id": b["id"], "kind": kind,
        "amount": bd["charge"], "points_redeemed": bd["points_redeemed"],
        "razorpay_order_id": oid, "method": "in_app", "status": "created",
        "at": now,
    })
    label = "Advance" if kind == "advance" else "Balance"
    return {"order_id": oid, "amount": amount_paise, "currency": "INR",
            "razorpay_key_id": RAZORPAY_KEY_ID if live else (RAZORPAY_KEY_ID or "rzp_test_mock"),
            "mode": "live" if live else "mock",
            "name": "Thara", "description": f"{label} for booking {b['id'][:8]}",
            "prefill": {"email": u.get("email") or "", "contact": u.get("phone") or ""},
            **bd}


@api.post("/payments/verify")
async def verify_payment(body: PayVerifyIn, u: dict = Depends(require_role("customer"))):
    b = await db.bookings.find_one({"id": body.booking_id, "customer_id": u["id"]})
    if not b: raise HTTPException(404)
    b = apply_booking_payments({k: v for k, v in b.items() if k != "_id"})
    kind = _infer_pay_kind(b, body.kind)
    # Idempotency
    if kind == "advance" and _advance_is_paid(b):
        return {"success": True, "kind": "advance", "already_paid": True,
                "earned_points": int(b.get("points_earned_advance") or b.get("points_earned") or 0),
                "redeemed_points": int(b.get("points_redeemed") or 0)}
    if kind == "balance" and _balance_settled(b):
        return {"success": True, "kind": "balance", "already_paid": True,
                "earned_points": int(b.get("points_earned_balance") or 0),
                "redeemed_points": 0}
    stored_oid = b.get("razorpay_advance_order_id") if kind == "advance" else b.get("razorpay_balance_order_id")
    stored_oid = stored_oid or (b.get("razorpay_order_id") if kind == "advance" else None)
    if stored_oid and body.razorpay_order_id != stored_oid:
        raise HTTPException(400, "Order id does not match this booking")
    live = PAYMENT_MODE == "live" and RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
    if live:
        if not body.razorpay_payment_id or not body.razorpay_signature:
            raise HTTPException(400, "Payment signature is required")
        if not _verify_razorpay_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
            raise HTTPException(400, "Signature mismatch")
    elif PAYMENT_MODE == "live":
        raise HTTPException(503, "Razorpay is not configured")
    if kind == "advance":
        if b.get("status") != "confirmed":
            raise HTTPException(409, "The 20% advance can be paid after the partner confirms this booking")
    else:
        if b.get("status") != "booked" or not _advance_is_paid(b):
            raise HTTPException(409, "Pay the 20% advance first")
        if b.get("balance_status") == "claimed_offline":
            raise HTTPException(409, "Waiting for the partner to confirm they received the balance")
        if not _event_reached(b.get("event_date") or "2099-01-01"):
            raise HTTPException(409, f"The balance is due on {b.get('event_date')}")

    now = datetime.now(timezone.utc).isoformat()
    if kind == "advance":
        redeemed = int(b.get("points_redeemed") or 0)
        paid_amt = int(b.get("advance_charged") if b.get("advance_charged") is not None else (b.get("advance_amount") or 0) - redeemed)
        if redeemed > 0:
            await db.users.update_one({"id": u["id"]}, {"$inc": {"points": -redeemed}})
            await db.point_history.insert_one({"id": str(uuid.uuid4()), "user_id": u["id"],
                "delta": -redeemed, "reason": "redeem", "booking_id": body.booking_id,
                "at": now})
        earn, new_tier, tier_up, boost_pct = await _award_points(u["id"], body.booking_id, paid_amt)
        await db.bookings.update_one({"id": body.booking_id}, {"$set": {
            "status": "booked",
            "advance_paid": True,
            "advance_paid_at": now,
            "advance_charged": paid_amt,
            "payment_status": "advance_paid",
            "payment_method_advance": "in_app",
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_advance_payment_id": body.razorpay_payment_id,
            "points_earned": earn,
            "points_earned_advance": earn,
        }})
        await db.payments.update_many(
            {"booking_id": body.booking_id, "kind": "advance", "razorpay_order_id": body.razorpay_order_id},
            {"$set": {"status": "paid", "razorpay_payment_id": body.razorpay_payment_id,
                      "points_earned": earn, "paid_at": now}})
        try:
            v = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "name": 1, "owner_id": 1})
            subj, html, prev = tpl_payment_receipt(u["name"], v["name"] if v else "partner", paid_amt, earn, kind="advance")
            await send_email(u["email"], subj, html, prev)
            await send_push([u["id"]], "Advance paid — date locked",
                f"₹{paid_amt:,} advance paid to {v['name'] if v else 'partner'}. Balance ₹{int(b.get('balance_amount') or 0):,} is due on {b.get('event_date')}."
                + (f" +{earn} points!" if earn else ""),
                action_url=f"/booking-detail/{body.booking_id}")
            owner = await db.users.find_one({"id": (v or {}).get("owner_id")}, {"_id": 0, "id": 1}) if v else None
            if owner:
                await send_push([owner["id"]], "Advance received",
                    f"{u.get('name') or 'A customer'} paid ₹{paid_amt:,} to lock {b.get('event_date')}.",
                    action_url="/(vendor)/bookings")
        except Exception as e:
            logger.warning(f"advance payment notify failed: {e}")
        return {"success": True, "kind": "advance", "earned_points": earn, "redeemed_points": redeemed,
                "tier": new_tier["name"], "tier_up": tier_up, "boost_pct": boost_pct,
                "status": "booked", "balance_amount": int(b.get("balance_amount") or 0),
                "event_date": b.get("event_date")}

    # Balance in-app
    paid_amt = int(b.get("balance_amount") or 0)
    earn, new_tier, tier_up, boost_pct = await _award_points(u["id"], body.booking_id, paid_amt)
    await db.bookings.update_one({"id": body.booking_id}, {"$set": {
        "balance_status": "paid_in_app",
        "balance_paid_at": now,
        "payment_method_balance": "in_app",
        "payment_status": "paid",
        "razorpay_balance_payment_id": body.razorpay_payment_id,
        "points_earned_balance": earn,
    }})
    await db.payments.update_many(
        {"booking_id": body.booking_id, "kind": "balance", "razorpay_order_id": body.razorpay_order_id},
        {"$set": {"status": "paid", "razorpay_payment_id": body.razorpay_payment_id,
                  "points_earned": earn, "paid_at": now}})
    try:
        v = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "name": 1, "owner_id": 1})
        subj, html, prev = tpl_payment_receipt(u["name"], v["name"] if v else "partner", paid_amt, earn, kind="balance")
        await send_email(u["email"], subj, html, prev)
        await send_push([u["id"]], "Balance paid",
            f"₹{paid_amt:,} balance paid to {v['name'] if v else 'partner'}."
            + (f" +{earn} points!" if earn else ""),
            action_url=f"/booking-detail/{body.booking_id}")
        owner = await db.users.find_one({"id": (v or {}).get("owner_id")}, {"_id": 0, "id": 1}) if v else None
        if owner:
            await send_push([owner["id"]], "Balance received",
                f"{u.get('name') or 'A customer'} paid the remaining ₹{paid_amt:,} in the app.",
                action_url="/(vendor)/bookings")
    except Exception as e:
        logger.warning(f"balance payment notify failed: {e}")
    return {"success": True, "kind": "balance", "earned_points": earn, "redeemed_points": 0,
            "tier": new_tier["name"], "tier_up": tier_up, "boost_pct": boost_pct,
            "status": "booked", "payment_status": "paid"}


# --- Referrals & Loyalty ---
@api.get("/me/referral")
async def my_referral(u: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": u["id"]}, {"_id": 0, "password_hash": 0})
    code = user.get("referral_code")
    if not code:
        code = gen_referral_code()
        await db.users.update_one({"id": u["id"]}, {"$set": {"referral_code": code}})
    invited = await db.users.count_documents({"referred_by": code})
    share_text = (f"Join Thara — India's premium event marketplace. "
                  f"Use my code {code} to get 200 bonus points (worth ₹200 off). "
                  f"Get the app: https://thara.app")
    return {"code": code, "invited_count": invited, "share_text": share_text}

@api.post("/me/apply-referral")
async def apply_referral(body: ApplyReferralIn, u: dict = Depends(get_current_user)):
    code = body.code.strip().upper()
    user = await db.users.find_one({"id": u["id"]}, {"_id": 0})
    if user.get("referred_by"):
        raise HTTPException(400, "You've already used a referral code")
    if user.get("referral_code") == code:
        raise HTTPException(400, "Can't use your own code")
    referrer = await db.users.find_one({"referral_code": code}, {"_id": 0})
    if not referrer:
        raise HTTPException(404, "Invalid referral code")
    # Award both — bonus also increments lifetime tier progress for referees
    BONUS = 200
    await db.users.update_one({"id": u["id"]}, {"$set": {"referred_by": code},
        "$inc": {"points": BONUS, "lifetime_points": BONUS}})
    await db.users.update_one({"id": referrer["id"]},
        {"$inc": {"points": BONUS, "lifetime_points": BONUS}})
    now = datetime.now(timezone.utc).isoformat()
    await db.point_history.insert_one({"id": str(uuid.uuid4()), "user_id": u["id"],
        "delta": BONUS, "reason": "referral_signup", "at": now})
    await db.point_history.insert_one({"id": str(uuid.uuid4()), "user_id": referrer["id"],
        "delta": BONUS, "reason": "referral_bonus", "at": now})
    return {"success": True, "awarded": BONUS}

def compute_tier(lifetime: int) -> dict:
    if lifetime >= 5000:
        return {"name": "Platinum", "icon": "diamond", "color": "#E5E4E2",
                "boost": 0.10, "min": 5000, "next": None, "next_at": None,
                "perks": ["10% bonus cashback", "Priority support", "Exclusive concierge"]}
    if lifetime >= 1000:
        return {"name": "Gold", "icon": "trophy", "color": "#D4AF37",
                "boost": 0.05, "min": 1000, "next": "Platinum", "next_at": 5000,
                "perks": ["5% bonus cashback", "Early access to combos"]}
    return {"name": "Silver", "icon": "medal", "color": "#C0C0C0",
            "boost": 0.0, "min": 0, "next": "Gold", "next_at": 1000,
            "perks": ["Standard 5% cashback", "Refer friends for +200 pts"]}

@api.get("/me/tier")
async def my_tier(u: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": u["id"]}, {"_id": 0, "lifetime_points": 1, "points": 1})
    lifetime = int((user or {}).get("lifetime_points", 0))
    balance = int((user or {}).get("points", 0))
    tier = compute_tier(lifetime)
    progress = 1.0 if tier["next_at"] is None else min(1.0, lifetime / tier["next_at"])
    return {"lifetime_points": lifetime, "balance": balance, "tier": tier, "progress": round(progress, 3)}

@api.get("/me/points")
async def my_points(u: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": u["id"]}, {"_id": 0, "points": 1})
    history = await db.point_history.find({"user_id": u["id"]}, {"_id": 0}).sort("at", -1).limit(50).to_list(50)
    return {"balance": int(user.get("points", 0)) if user else 0, "history": history}

# --- KYC ---
@api.post("/kyc")
async def submit_kyc(body: KycIn, u: dict = Depends(require_role("vendor"))):
    data = body.dict()
    for f in KYC_SECRET_FIELDS:
        data[f] = kyc_encrypt((data.get(f) or "").strip())
    data["encrypted"] = True
    doc = {"id": str(uuid.uuid4()), "vendor_id": u["vendor_id"], "user_id": u["id"],
           **data, "status": "pending",
           "submitted_at": datetime.now(timezone.utc).isoformat()}
    await db.kyc.insert_one(doc.copy())
    # No auto-approval: a Thara admin reviews and calls POST /api/admin/vendors/{id}/verify.
    await db.vendors.update_one({"id": u["vendor_id"]}, {"$set": {"kyc_status": "pending"}})
    return {"status": "pending", "kyc_id": doc["id"]}

@api.get("/kyc/me")
async def my_kyc(u: dict = Depends(require_role("vendor"))):
    k = await db.kyc.find_one({"vendor_id": u["vendor_id"]}, {"_id": 0}, sort=[("submitted_at", -1)])
    if k:  # vendor-self view: masked values only
        for f in ("pan_number", "gst_number"):
            raw = kyc_decrypt(k.get(f, "")) if k.get("encrypted") else k.get(f, "")
            k[f] = _mask(raw)
        k.pop("document_url", None)
    v = await db.vendors.find_one({"id": u["vendor_id"]}, {"_id": 0, "verified": 1})
    if v and v.get("verified"):
        return {**(k or {}), "status": "approved"}
    return k or {"status": "not_submitted"}

# --- Admin (manual verification for Hyderabad founding vendors) ---
def require_admin(x_admin_secret: str = Header(default="")):
    if not ADMIN_SECRET or not secrets.compare_digest(x_admin_secret, ADMIN_SECRET):
        raise HTTPException(403, "Admin secret required")
    return True

class AdminVerifyIn(BaseModel):
    approve: bool = True
    founding: bool = False
    note: str = ""

@api.post("/admin/vendors/{vendor_id}/verify")
async def admin_verify_vendor(vendor_id: str, body: Optional[AdminVerifyIn] = None, _: bool = Depends(require_admin)):
    body = body or AdminVerifyIn()
    v = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not v: raise HTTPException(404, "Partner not found")
    st = "approved" if body.approve else "rejected"
    upd = {"verified": body.approve, "kyc_status": st,
           "verified_at": datetime.now(timezone.utc).isoformat() if body.approve else None}
    if body.founding: upd["founding_vendor"] = True
    await db.vendors.update_one({"id": vendor_id}, {"$set": upd})
    await db.kyc.update_many({"vendor_id": vendor_id, "status": "pending"},
                             {"$set": {"status": st, "review_note": body.note}})
    svc = await db.services.count_documents({"vendor_id": vendor_id})
    v.update(upd)
    return {"vendor_id": vendor_id, "kyc_status": st, "verified": body.approve,
            "completeness": profile_completeness(v, svc)}

@api.get("/admin/vendors/{vendor_id}/kyc")
async def admin_vendor_kyc(vendor_id: str, _: bool = Depends(require_admin)):
    k = await db.kyc.find_one({"vendor_id": vendor_id}, {"_id": 0}, sort=[("submitted_at", -1)])
    if not k: raise HTTPException(404, "No KYC submitted")
    if k.get("encrypted"):
        for f in KYC_SECRET_FIELDS: k[f] = kyc_decrypt(k.get(f, ""))
    return k

@api.get("/admin/vendors/pending")
async def admin_pending(_: bool = Depends(require_admin)):
    items = await db.vendors.find({"kyc_status": "pending"}, {"_id": 0}).to_list(200)
    return [{"id": v["id"], "name": v["name"], "city": v.get("city"), "category": v.get("category")} for v in items]

# --- Vendor self (services, dashboard) ---
@api.get("/vendor/me")
async def my_vendor(u: dict = Depends(require_role("vendor"))):
    v = await db.vendors.find_one({"id": u["vendor_id"]}, {"_id": 0})
    return _vendor_pub(v, v["city"]) if v else None

@api.patch("/vendor/me")
async def update_my_vendor(body: VendorPatch, u: dict = Depends(require_role("vendor"))):
    upd = body.dict(exclude_none=True)
    apply_social_links(upd)
    if upd.get("cover") and upd["cover"] != STOCK_COVER: upd["cover_is_placeholder"] = False
    if "city" in upd and upd["city"] not in CITIES:
        raise HTTPException(422, f"City must be one of {', '.join(CITIES)}")
    if "event_types" in upd:
        valid = {e["id"] for e in EVENT_TYPES}
        upd["event_types"] = [e for e in upd["event_types"] if e in valid]
    if not upd: raise HTTPException(400, "Nothing to update")
    await db.vendors.update_one({"id": u["vendor_id"]}, {"$set": upd})
    v = await db.vendors.find_one({"id": u["vendor_id"]}, {"_id": 0})
    return _vendor_pub(v, v["city"])

@api.get("/vendor/dashboard")
async def vendor_dashboard(u: dict = Depends(require_role("vendor"))):
    vid = u["vendor_id"]
    rows = [apply_booking_payments(x) for x in await db.bookings.find({"vendor_id": vid}, {"_id": 0}).to_list(1000)]
    total = len(rows)
    pending = sum(1 for b in rows if b.get("status") == "pending")
    confirmed = sum(1 for b in rows if b.get("status") == "confirmed")
    booked = sum(1 for b in rows if b.get("status") == "booked")
    completed = sum(1 for b in rows if b.get("status") == "completed")
    advances_collected = sum(int(b.get("advance_charged") or b.get("advance_amount") or 0)
                             for b in rows if _advance_is_paid(b) and b.get("status") not in ("cancelled", "rejected"))
    balances_pending = sum(int(b.get("balance_amount") or 0)
                           for b in rows if b.get("status") == "booked" and not _balance_settled(b))
    balances_collected = sum(int(b.get("balance_amount") or 0)
                             for b in rows if _balance_settled(b) and b.get("status") in ("booked", "completed"))
    revenue = advances_collected + balances_collected
    v = await db.vendors.find_one({"id": vid}, {"_id": 0})
    svc = await db.services.count_documents({"vendor_id": vid})
    has_avail = bool(await db.availability.find_one({"vendor_id": vid}))
    kyc = await db.kyc.find_one({"vendor_id": vid}, {"_id": 0, "status": 1}, sort=[("submitted_at", -1)])
    kyc_status = "approved" if (v or {}).get("verified") else ((kyc or {}).get("status") or "not_submitted")
    completeness = profile_completeness(v or {}, svc, has_avail)
    chats = await db.chat_messages.distinct("booking_id", {"booking_id": {"$in": [
        b["id"] for b in await db.bookings.find({"vendor_id": vid}, {"_id": 0, "id": 1}).to_list(500)]}})
    return {"total_bookings": total, "pending": pending, "confirmed": confirmed,
            "booked": booked, "completed": completed, "revenue": revenue,
            "advances_collected": advances_collected,
            "balances_pending": balances_pending,
            "balances_collected": balances_collected,
            "views": int((v or {}).get("views", 0)), "inquiries": len(chats) + pending,
            "kyc_status": kyc_status, "completeness": completeness,
            "services_count": svc, "founding_vendor": bool((v or {}).get("founding_vendor")),
            "rating": v.get("rating", 0) if v else 0,
            "reviews_count": v.get("reviews_count", 0) if v else 0,
            "verified": v.get("verified", False) if v else False}

@api.get("/vendor/availability")
async def get_availability(u: dict = Depends(require_role("vendor"))):
    a = await db.availability.find_one({"vendor_id": u["vendor_id"]}, {"_id": 0})
    return a or {"vendor_id": u["vendor_id"], "blocked_dates": [], "max_per_day": 1}

@api.post("/vendor/availability")
async def set_availability(body: AvailabilityIn, u: dict = Depends(require_role("vendor"))):
    blocked = sorted({d for d in body.blocked_dates if _is_iso_date(d)})
    max_pd = body.max_per_day
    await db.availability.update_one({"vendor_id": u["vendor_id"]},
        {"$set": {"vendor_id": u["vendor_id"], "blocked_dates": blocked, "max_per_day": max_pd}},
        upsert=True)
    return {"blocked_dates": blocked, "max_per_day": max_pd}

@api.get("/vendor/services")
async def list_services(u: dict = Depends(require_role("vendor"))):
    vend = await db.vendors.find_one({"id": u["vendor_id"]}, {"_id": 0, "category": 1})
    cat = (vend or {}).get("category") or ""
    items = await db.services.find({"vendor_id": u["vendor_id"]}, {"_id": 0}).to_list(100)
    return [_service_pub(x, cat) for x in items]

@api.post("/vendor/services")
async def add_service(body: ServiceIn, u: dict = Depends(require_role("vendor"))):
    vend = await db.vendors.find_one({"id": u["vendor_id"]}, {"_id": 0, "category": 1})
    cat = (vend or {}).get("category") or ""
    payload = apply_social_links(body.dict())
    payload["price_unit"] = payload.get("price_unit") or price_unit_for(cat)
    doc = {"id": str(uuid.uuid4()), "vendor_id": u["vendor_id"], **payload,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.services.insert_one(doc.copy())
    return _service_pub(doc, cat)

@api.patch("/vendor/services/{sid}")
async def update_service(sid: str, body: ServicePatch, u: dict = Depends(require_role("vendor"))):
    vend = await db.vendors.find_one({"id": u["vendor_id"]}, {"_id": 0, "category": 1})
    cat = (vend or {}).get("category") or ""
    upd = body.dict(exclude_none=True)
    apply_social_links(upd)
    if not upd: raise HTTPException(400, "Nothing to update")
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    r = await db.services.update_one({"id": sid, "vendor_id": u["vendor_id"]}, {"$set": upd})
    if r.matched_count == 0: raise HTTPException(404, "Service not found")
    return _service_pub(await db.services.find_one({"id": sid}, {"_id": 0}), cat)

@api.delete("/vendor/services/{sid}")
async def delete_service(sid: str, u: dict = Depends(require_role("vendor"))):
    await db.services.delete_one({"id": sid, "vendor_id": u["vendor_id"]})
    return {"ok": True}

# --- Uploads ---
@api.post("/uploads")
async def upload_image(request: Request, file: UploadFile = File(...),
                       u: dict = Depends(get_current_user)):
    rate_limit(f"upload:{u['id']}", 30)
    ext = UPLOAD_TYPES.get((file.content_type or "").lower())
    if not ext:
        raise HTTPException(415, "Only JPEG, PNG or WebP images are allowed")
    data = await file.read(UPLOAD_MAX_BYTES + 1)
    if len(data) > UPLOAD_MAX_BYTES:
        raise HTTPException(413, "Image too large (max 5 MB)")
    if not data: raise HTTPException(400, "Empty file")
    name = f"{uuid.uuid4().hex}{ext}"
    try: (UPLOAD_DIR / name).write_bytes(data)
    except OSError as e: logger.warning(f"upload disk cache failed (Mongo copy kept): {e}")
    from bson import Binary
    await db.media.insert_one({"file": name, "data": Binary(data), "content_type": (file.content_type or "").lower(),
                               "user_id": u["id"], "created_at": datetime.now(timezone.utc).isoformat()})
    await db.uploads.insert_one({"file": name, "user_id": u["id"], "size": len(data),
                                 "created_at": datetime.now(timezone.utc).isoformat()})
    rel = f"/api/media/{name}"  # same file is also served at /uploads/{name}
    base = BACKEND_URL or str(request.base_url).rstrip("/")
    return {"url": f"{base}{rel}", "path": rel}

# --- Profile completeness / listing gate helpers ---
PLACEHOLDER_DESCRIPTIONS = {"new vendor on thara.", "new vendor on eventpro.", "new partner on thara.", "new partner on eventpro.", ""}
STOCK_COVER = "https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg"

def _is_uploaded(url: str) -> bool:
    return "/uploads/" in (url or "") or "/api/media/" in (url or "")

def profile_completeness(v: dict, services_count: int, has_availability: bool = True) -> dict:
    """Listing rules (all must pass for GET /api/vendors to return a vendor):
      1. verified == True (set only by admin via POST /api/admin/vendors/{id}/verify, or seed data)
      2. description is not the signup placeholder and is >= 30 chars
      3. cover is set and is not the signup stock image (cover_is_placeholder flag)
      4. photos: >= 3 gallery photos, OR an uploaded cover plus >= 1 uploaded gallery photo
      5. category is set
      6. >= 1 service package exists
    Availability is tracked for the strength meter only (not required to list)."""
    desc = (v.get("description") or "").strip()
    cover = v.get("cover") or ""
    gallery = [g for g in (v.get("gallery") or []) if g]
    checks = {
        "description": desc.lower() not in PLACEHOLDER_DESCRIPTIONS and len(desc) >= 30,
        # Signup stock cover doesn't count until the vendor sets their own (legacy rows: stock cover + placeholder text).
        "cover": bool(cover) and not v.get("cover_is_placeholder")
                 and not (cover == STOCK_COVER and desc.lower() in PLACEHOLDER_DESCRIPTIONS),
        "photos": len(gallery) >= 3 or (_is_uploaded(cover) and any(_is_uploaded(g) for g in gallery)),
        "category": bool(v.get("category")),
        "services": services_count >= 1,
        "event_types": bool(v.get("event_types")),
        "availability": has_availability,
        "kyc": bool(v.get("verified")),
    }
    required = ["description", "cover", "photos", "category", "services", "kyc"]
    pct = int(round(100 * sum(checks.values()) / len(checks)))
    return {"percent": pct, "checks": checks,
            "listable": all(checks[k] for k in required),
            "missing": [k for k in required if not checks[k]]}

async def _service_counts(vendor_ids: List[str]) -> dict:
    if not vendor_ids: return {}
    rows = await db.services.aggregate([{"$match": {"vendor_id": {"$in": vendor_ids}}},
                                        {"$group": {"_id": "$vendor_id", "n": {"$sum": 1}}}]).to_list(1000)
    return {r["_id"]: r["n"] for r in rows}

def _is_iso_date(d: str) -> bool:
    try: datetime.strptime(d, "%Y-%m-%d"); return True
    except Exception: return False

async def _availability_summary(vendor_id: str) -> dict:
    """Blocked dates set by vendor + dates where booked (advance paid) or completed bookings reached max_per_day."""
    a = await db.availability.find_one({"vendor_id": vendor_id}, {"_id": 0}) or {}
    max_pd = int(a.get("max_per_day", 1) or 1)
    rows = await db.bookings.aggregate([
        {"$match": {"vendor_id": vendor_id, "status": {"$in": ["booked", "completed"]}}},
        {"$group": {"_id": "$event_date", "n": {"$sum": 1}}}]).to_list(2000)
    full = sorted(r["_id"] for r in rows if r["n"] >= max_pd)
    return {"vendor_id": vendor_id, "blocked_dates": sorted(a.get("blocked_dates", [])),
            "full_dates": full, "max_per_day": max_pd}

# --- Combo Packages ---
@api.get("/combos")
async def list_combos():
    return await db.combos.find({}, {"_id": 0}).to_list(50)

# ── Seeding ──────────────────────────────────────────────────────────────────
SEED_IMAGES = {
    "venues": ["https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg",
               "https://images.pexels.com/photos/35042459/pexels-photo-35042459.jpeg",
               "https://images.pexels.com/photos/28950121/pexels-photo-28950121.jpeg"],
    "catering": ["https://images.pexels.com/photos/37116449/pexels-photo-37116449.jpeg",
                 "https://images.pexels.com/photos/27408822/pexels-photo-27408822.jpeg"],
    "photography": ["https://images.pexels.com/photos/11813973/pexels-photo-11813973.jpeg",
                    "https://images.pexels.com/photos/32471938/pexels-photo-32471938.jpeg"],
    "decor": ["https://images.pexels.com/photos/35508916/pexels-photo-35508916.jpeg",
              "https://images.pexels.com/photos/28950121/pexels-photo-28950121.jpeg"],
    "music": ["https://images.pexels.com/photos/28950121/pexels-photo-28950121.jpeg",
              "https://images.pexels.com/photos/35042459/pexels-photo-35042459.jpeg"],
    "planning": ["https://images.pexels.com/photos/13204648/pexels-photo-13204648.jpeg"],
}

SEED_VENDORS = [
    # Hyderabad
    ("Taj Krishna Banquets", "venues", "Hyderabad", 250000, 4.8, "Iconic 5-star banquet venue with grand ballrooms.", ["AC Hall", "Valet", "Bridal Suite", "Stage"]),
    ("Paradise Royal Caterers", "catering", "Hyderabad", 850, 4.6, "Authentic Hyderabadi & North Indian wedding catering.", ["Live Counters", "Vegetarian", "Non-Veg", "Buffet"]),
    ("ShaadiClicks Photography", "photography", "Hyderabad", 75000, 4.9, "Cinematic candid wedding photography & films.", ["Drone", "Same-Day Edits", "Pre-Wedding"]),
    ("Marigold Decor Studio", "decor", "Hyderabad", 60000, 4.7, "Luxe floral & mandap decor for weddings & sangeet.", ["Floral", "Lighting", "Mandap", "Stage"]),
    ("Beats by Aryan DJ", "music", "Hyderabad", 35000, 4.5, "Premium DJ + Live Dhol for sangeet & receptions.", ["DJ", "Dhol", "Sound System", "Lights"]),
    # Mumbai
    ("The Leela Ballroom", "venues", "Mumbai", 500000, 4.9, "Opulent ballroom in Andheri — perfect for receptions.", ["AC Hall", "Valet", "Catering Onsite"]),
    ("Mumbai Spice Catering", "catering", "Mumbai", 1200, 4.7, "Multi-cuisine catering — Maharashtrian, Punjabi, Continental.", ["Buffet", "Live Counters", "Jain Menu"]),
    ("Stories By Riya", "photography", "Mumbai", 110000, 4.8, "Boutique storyteller for intimate weddings.", ["Candid", "Cinematography", "Albums"]),
    ("Petal & Pearl Decor", "decor", "Mumbai", 90000, 4.8, "Boho-luxe wedding decor in pastels & gold.", ["Floral", "Drapes", "Pastels"]),
    ("EventCraft Planners Mumbai", "planning", "Mumbai", 150000, 4.7, "Full-service wedding planners with global partners.", ["End-to-End", "Destination", "Coordination"]),
    # Delhi
    ("ITC Maurya Banquets", "venues", "Delhi", 600000, 4.9, "Iconic Delhi luxury banquet with regal interiors.", ["Premium", "Valet", "Suites"]),
    ("Royal Rasoi Catering", "catering", "Delhi", 1100, 4.6, "Mughlai, Awadhi & North Indian catering.", ["Tandoor", "Live", "Veg/Non-Veg"]),
    ("Frames of Forever", "photography", "Delhi", 95000, 4.7, "Vibrant wedding photography & reels.", ["Candid", "Reels", "Pre-wedding"]),
    ("Tulip & Co Decor", "decor", "Delhi", 80000, 4.6, "Royal mandaps & sangeet decor with Mughal influences.", ["Mandap", "Royal Theme"]),
    ("Saregama Live", "music", "Delhi", 45000, 4.5, "Live Sufi, Bollywood DJ & dhol nawaab.", ["Live Band", "Sufi", "DJ"]),
    ("Knot & Notes Planners", "planning", "Delhi", 175000, 4.8, "Premium wedding planning & destination expertise.", ["Destination", "Curated", "Concierge"]),
    # Bangalore
    ("The Oberoi Lawns", "venues", "Bangalore", 400000, 4.8, "Garden weddings under the stars in Bengaluru.", ["Garden", "Outdoor", "Valet"]),
    ("South Spice Caterers", "catering", "Bangalore", 950, 4.6, "South Indian + Mughlai wedding feasts.", ["Live Dosa", "Buffet"]),
    ("Lightroom Studios BLR", "photography", "Bangalore", 85000, 4.7, "Modern wedding photography & reels.", ["Candid", "Drone"]),
    ("Bloom Studio Decor", "decor", "Bangalore", 70000, 4.7, "Minimalist boho decor with white & gold.", ["Boho", "Minimal"]),
]

SEED_COMBOS = [
    {"id": "c1", "name": "Royal Wedding Bundle", "city": "Hyderabad",
     "cover": "https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg",
     "description": "Venue + Catering + Decor + Photography — fully managed.",
     "original_price": 850000, "price": 699000, "savings": 151000,
     "includes": ["Premium Banquet Venue", "Catering (200 pax)", "Floral Decor", "Photography"]},
    {"id": "c2", "name": "Sangeet Night Combo", "city": "Mumbai",
     "cover": "https://images.pexels.com/photos/28950121/pexels-photo-28950121.jpeg",
     "description": "DJ + Decor + Lighting + Photography for an unforgettable sangeet.",
     "original_price": 280000, "price": 219000, "savings": 61000,
     "includes": ["DJ + Dhol", "Floral Decor", "Sangeet Photography"]},
    {"id": "c3", "name": "Corporate Gala Pack", "city": "Delhi",
     "cover": "https://images.pexels.com/photos/35042459/pexels-photo-35042459.jpeg",
     "description": "Venue + AV + Catering for 100 — premium corporate events.",
     "original_price": 450000, "price": 365000, "savings": 85000,
     "includes": ["Banquet Venue", "AV Setup", "Catering 100 pax"]},
]

async def seed():
    if not ENABLE_DEMO_SEED:
        logger.info("Demo seed disabled (set ENABLE_DEMO_SEED=true for local demo data)")
        return
    if await db.vendors.count_documents({}) > 0:
        return
    logger.info("Seeding vendors…")
    # Owner accounts for vendors
    docs = []
    for i, (name, cat, city, price, rating, desc, facilities) in enumerate(SEED_VENDORS):
        owner_id = str(uuid.uuid4())
        vid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": owner_id, "name": name + " Admin",
            "email": f"vendor{i+1}@eventpro.in", "phone": f"+9199{10000000+i}",
            "password_hash": hash_pw("Vendor@123"), "role": "vendor",
            "city": city, "vendor_id": vid,
            "avatar": f"https://ui-avatars.com/api/?name={name.replace(' ','+')}&background=D4AF37&color=0B0C10",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        imgs = SEED_IMAGES.get(cat, SEED_IMAGES["venues"])
        clat, clng = CITY_COORDS.get(city, (17.3850, 78.4867))
        # Small offset so vendors are distributed within city
        h = hash(name)
        lat_offset = ((h >> 8) % 200 - 100) / 1000.0   # ±0.1°
        lng_offset = ((h >> 16) % 200 - 100) / 1000.0
        docs.append({
            "id": vid, "owner_id": owner_id, "name": name, "category": cat, "city": city,
            "cover": imgs[0], "gallery": imgs,
            "description": desc, "starting_price": price, "rating": rating,
            "reviews_count": (hash(name) % 80) + 12,
            "seed_rating": rating, "seed_reviews_count": (hash(name) % 80) + 12,
            "price_unit": price_unit_for(cat),
            "verified": True,
            "facilities": facilities,
            "event_types": ["wedding", "sangeet", "reception"] if cat in ("venues","decor","music") else ["wedding","corporate","birthday"],
            "address": f"{name}, {city}", "phone": f"+9199{10000000+i}",
            "lat": round(clat + lat_offset, 6), "lng": round(clng + lng_offset, 6),
            "created_at": datetime.now(timezone.utc).isoformat(),
            **_demo_social_links(name, i),
        })
    await db.vendors.insert_many(docs)
    await _seed_services(docs)
    # Combos
    for c in SEED_COMBOS:
        await db.combos.update_one({"id": c["id"]}, {"$set": c}, upsert=True)
    # Demo customer
    if not await db.users.find_one({"email": "customer.demo@eventpro.in"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "name": "Demo Customer",
            "email": "customer.demo@eventpro.in", "phone": "+919999999999",
            "password_hash": hash_pw("Demo@123"), "role": "customer",
            "city": "Hyderabad", "referral_code": "EPDEMO1", "points": 500, "lifetime_points": 1500,
            "avatar": "https://ui-avatars.com/api/?name=Demo+Customer&background=D4AF37&color=0B0C10",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    logger.info("Seeding complete — %d vendors, %d combos", len(docs), len(SEED_COMBOS))

async def _seed_services(vendors: List[dict]):
    """Give seeded demo vendors one package each so they pass the listing gate."""
    pool = [u for imgs in SEED_IMAGES.values() for u in imgs]
    for v in vendors:
        gal = list(dict.fromkeys(v.get("gallery") or []))
        if len(gal) < 3:
            gal += [u for u in pool if u not in gal][: 3 - len(gal)]
            await db.vendors.update_one({"id": v["id"]}, {"$set": {"gallery": gal}})
            v["gallery"] = gal
        if await db.services.count_documents({"vendor_id": v["id"]}) == 0:
            await db.services.insert_one({"id": str(uuid.uuid4()), "vendor_id": v["id"],
                "title": "Signature Package", "description": v["description"],
                "price": v["starting_price"], "photos": v.get("gallery", [])[:3],
                "price_unit": price_unit_for(v.get("category")),
                "created_at": datetime.now(timezone.utc).isoformat()})

async def _migrate_booking_payments():
    """Backfill advance/balance fields on existing bookings (in-memory or persistent)."""
    rows = await db.bookings.find({}).to_list(5000)
    for raw in rows:
        bid = raw.get("id")
        if not bid:
            continue
        patched = apply_booking_payments({k: v for k, v in raw.items() if k != "_id"})
        fields = {k: patched[k] for k in (
            "gst_amount", "total_amount", "advance_amount", "advance_paid", "advance_charged",
            "advance_paid_at", "balance_amount", "balance_status", "balance_paid_at",
            "payment_status", "status", "payment_method_advance", "payment_method_balance",
        ) if k in patched and patched[k] is not None}
        await db.bookings.update_one({"id": bid}, {"$set": fields})

@app.on_event("startup")
async def on_startup():
    # Don't let a DB outage at cold start kill the whole function (serverless):
    # log it and keep serving; DB-backed routes will return errors until it's reachable.
    try:
        await _startup_db()
    except Exception as e:
        logger.error(f"Startup DB init failed: {type(e).__name__}: {str(e)[:200]}")

async def _startup_db():
    await db.users.create_index("email", unique=True)
    await db.vendors.create_index("category")
    await db.bookings.create_index("customer_id")
    await db.bookings.create_index("vendor_id")
    await db.otp_codes.create_index("phone", unique=True)
    await db.media.create_index("file", unique=True)
    await seed()
    await _migrate_booking_payments()
    if not ENABLE_DEMO_SEED: return
    # Backfill: existing seeded demo vendors get a package so they remain listed.
    demo_owners = [x["id"] for x in await db.users.find(
        {"role": "vendor", "email": {"$regex": "@eventpro\\.in$"}}, {"_id": 0, "id": 1}).to_list(500)]
    demo = await db.vendors.find({"owner_id": {"$in": demo_owners}}, {"_id": 0}).to_list(500)
    await _seed_services(demo)
    for i, v in enumerate(demo):
        if v.get("instagram_url") or v.get("facebook_url") or v.get("website_url"):
            continue
        links = _demo_social_links(v.get("name") or "", i)
        if links:
            await db.vendors.update_one({"id": v["id"]}, {"$set": links})

@app.on_event("shutdown")
async def on_shutdown():
    mongo.close()

# ── WebSocket chat ───────────────────────────────────────────────────────────
class ConnMgr:
    def __init__(self): self.rooms: dict[str, set[WebSocket]] = {}
    async def join(self, room: str, ws: WebSocket):
        self.rooms.setdefault(room, set()).add(ws)
    async def leave(self, room: str, ws: WebSocket):
        if room in self.rooms:
            self.rooms[room].discard(ws)
            if not self.rooms[room]: del self.rooms[room]
    async def broadcast(self, room: str, payload: dict, exclude: WebSocket = None):
        for ws in list(self.rooms.get(room, [])):
            if ws is exclude: continue
            try: await ws.send_json(payload)
            except Exception: pass
mgr = ConnMgr()

@app.websocket("/api/ws/chat/{booking_id}")
async def ws_chat(websocket: WebSocket, booking_id: str, token: str = ""):
    # Accept first so we can send RFC close codes (4401/4403/4404). Closing before
    # accept is rewritten as a generic HTTP 403 by the ASGI server.
    await websocket.accept()
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": data["sub"]}, {"_id": 0, "password_hash": 0})
        if not user: raise Exception("user not found")
    except Exception:
        await websocket.close(code=4401)
        return
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        await websocket.close(code=4404); return
    if user["role"] == "customer" and b["customer_id"] != user["id"]:
        await websocket.close(code=4403); return
    if user["role"] == "vendor" and b["vendor_id"] != user.get("vendor_id"):
        await websocket.close(code=4403); return
    await mgr.join(booking_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try: ev = json_mod.loads(raw)
            except Exception: continue
            kind = ev.get("type")
            if kind == "typing":
                await mgr.broadcast(booking_id, {"type": "typing", "user_id": user["id"],
                                                  "sender_name": user["name"]}, exclude=websocket)
            elif kind == "message":
                text = (ev.get("text") or "").strip()
                if not text: continue
                msg = {"id": str(uuid.uuid4()), "booking_id": booking_id,
                       "sender_id": user["id"], "sender_role": user["role"],
                       "sender_name": user["name"], "text": text,
                       "created_at": datetime.now(timezone.utc).isoformat()}
                await db.chat_messages.insert_one(msg.copy())
                await mgr.broadcast(booking_id, {"type": "message", "message": msg})
    except WebSocketDisconnect:
        pass
    finally:
        await mgr.leave(booking_id, websocket)

app.include_router(api)
