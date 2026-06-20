"""EventPro backend — Indian D2C marketplace for event services."""
import os
import uuid
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query
from fastapi.security import OAuth2PasswordBearer
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("eventpro")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# ── Config ───────────────────────────────────────────────────────────────────
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET_KEY"]
JWT_ALG = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_MIN = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
PAYMENT_MODE = os.environ.get("PAYMENT_MODE", "mock")

# ── DB ───────────────────────────────────────────────────────────────────────
mongo = AsyncIOMotorClient(MONGO_URL)
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
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    phone: str
    role: Role
    city: Optional[str] = None
    vendor_id: Optional[str] = None
    avatar: Optional[str] = None

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
    owner_id: Optional[str] = None

class BookingIn(BaseModel):
    vendor_id: str
    event_type: str
    event_date: str  # YYYY-MM-DD
    guests: int = 100
    notes: str = ""
    amount: int  # in INR

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

class AIChatIn(BaseModel):
    conversation_id: Optional[str] = None
    message: str

class PayOrderIn(BaseModel):
    booking_id: str

class PayVerifyIn(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class KycIn(BaseModel):
    business_name: str
    gst_number: str = ""
    pan_number: str
    address: str
    document_url: str = ""

class ServiceIn(BaseModel):
    title: str
    description: str
    price: int
    photos: List[str] = []

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="EventPro API")
api = APIRouter(prefix="/api")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
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

# ── Endpoints ────────────────────────────────────────────────────────────────
@api.get("/")
async def root(): return {"ok": True, "service": "EventPro API"}

@api.get("/event-types") 
async def get_event_types(): return EVENT_TYPES

@api.get("/categories")
async def get_categories(): return CATEGORIES

@api.get("/cities")
async def get_cities(): return CITIES

# --- Auth ---
@api.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn):
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "name": body.name, "email": body.email.lower(), "phone": body.phone,
        "password_hash": hash_pw(body.password), "role": body.role, "city": body.city,
        "avatar": f"https://ui-avatars.com/api/?name={body.name.replace(' ','+')}&background=D4AF37&color=0B0C10",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.role == "vendor":
        vid = str(uuid.uuid4())
        doc["vendor_id"] = vid
        await db.vendors.insert_one({
            "id": vid, "owner_id": uid, "name": body.name + " Services",
            "category": "venues", "city": body.city or "Hyderabad",
            "cover": "https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg",
            "gallery": ["https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg"],
            "description": "New vendor on EventPro.", "starting_price": 50000,
            "rating": 0.0, "reviews_count": 0, "verified": False,
            "facilities": [], "event_types": ["wedding"], "address": body.city or "",
            "phone": body.phone, "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await db.users.insert_one(doc)
    token = make_token(uid, body.role)
    user = {k: v for k, v in doc.items() if k != "password_hash" and k != "created_at"}
    return {"token": token, "user": user}

@api.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email.lower()})
    if not u or not verify_pw(body.password, u["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
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

# --- Vendors ---
def _vendor_pub(v: dict, user_city: str = "Hyderabad") -> dict:
    # Pseudo-distance based on city match
    same = v.get("city") == user_city
    dist = 2.5 + (hash(v["id"]) % 80) / 10.0 if same else 50 + (hash(v["id"]) % 200) / 10.0
    return {
        "id": v["id"], "name": v["name"], "category": v["category"], "city": v["city"],
        "cover": v["cover"], "gallery": v.get("gallery", []), "description": v["description"],
        "starting_price": v["starting_price"], "rating": round(v.get("rating", 0), 1),
        "reviews_count": v.get("reviews_count", 0), "distance_km": round(dist, 1),
        "verified": v.get("verified", False), "facilities": v.get("facilities", []),
        "event_types": v.get("event_types", []), "address": v.get("address", ""),
        "phone": v.get("phone", ""), "owner_id": v.get("owner_id"),
    }

@api.get("/vendors")
async def list_vendors(city: Optional[str] = None, category: Optional[str] = None,
                       event_type: Optional[str] = None, q: Optional[str] = None,
                       trending: Optional[bool] = None, limit: int = 50):
    query: dict = {}
    if city: query["city"] = city
    if category: query["category"] = category
    if event_type: query["event_types"] = event_type
    if q: query["name"] = {"$regex": q, "$options": "i"}
    cursor = db.vendors.find(query, {"_id": 0}).limit(limit)
    if trending:
        cursor = db.vendors.find(query, {"_id": 0}).sort("rating", -1).limit(limit)
    items = await cursor.to_list(limit)
    return [_vendor_pub(v, city or "Hyderabad") for v in items]

@api.get("/vendors/{vendor_id}")
async def get_vendor(vendor_id: str):
    v = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not v: raise HTTPException(404, "Vendor not found")
    return _vendor_pub(v, v.get("city", "Hyderabad"))

@api.get("/vendors/{vendor_id}/similar")
async def similar_vendors(vendor_id: str):
    v = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not v: return []
    items = await db.vendors.find(
        {"category": v["category"], "id": {"$ne": vendor_id}}, {"_id": 0}
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
    v = await db.vendors.find_one({"id": b["vendor_id"]}, {"_id": 0, "name": 1, "cover": 1})
    c = await db.users.find_one({"id": b["customer_id"]}, {"_id": 0, "name": 1})
    return {**b, "vendor_name": v["name"] if v else "Vendor",
            "vendor_cover": v["cover"] if v else "",
            "customer_name": c["name"] if c else "Customer"}

@api.post("/bookings")
async def create_booking(body: BookingIn, u: dict = Depends(require_role("customer"))):
    v = await db.vendors.find_one({"id": body.vendor_id})
    if not v: raise HTTPException(404, "Vendor not found")
    bid = str(uuid.uuid4())
    doc = {"id": bid, "vendor_id": body.vendor_id, "customer_id": u["id"],
           "event_type": body.event_type, "event_date": body.event_date,
           "guests": body.guests, "notes": body.notes, "amount": body.amount,
           "status": "pending", "payment_status": "unpaid",
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.bookings.insert_one(doc.copy())
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
    await db.bookings.update_one({"id": bid}, {"$set": {"status": status_val}})
    b["status"] = status_val
    return await _enrich_booking(b)

# --- Reviews ---
@api.post("/reviews")
async def add_review(body: ReviewIn, u: dict = Depends(require_role("customer"))):
    doc = {"id": str(uuid.uuid4()), "vendor_id": body.vendor_id, "booking_id": body.booking_id,
           "user_id": u["id"], "user_name": u["name"], "user_avatar": u.get("avatar"),
           "rating": body.rating, "comment": body.comment,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.reviews.insert_one(doc.copy())
    # recompute vendor rating
    revs = await db.reviews.find({"vendor_id": body.vendor_id}, {"_id": 0}).to_list(1000)
    if revs:
        avg = sum(r["rating"] for r in revs) / len(revs)
        await db.vendors.update_one({"id": body.vendor_id},
                                    {"$set": {"rating": avg, "reviews_count": len(revs)}})
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
    if not b: raise HTTPException(404)
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
                       system_message=("You are EventPro AI, an expert Indian event-planning assistant. "
                                       "Help users plan weddings, sangeet, birthdays, corporate events. "
                                       "Suggest vendors, budgets in INR, timelines. Be concise, warm, premium."))
        chat = chat.with_model("openai", "gpt-5.2")
        # Replay last 10 messages for context (the SDK manages session per session_id)
        msg = UserMessage(text=body.message)
        reply = await chat.send_message(msg)
        if not isinstance(reply, str):
            reply = str(reply)
    except Exception as e:
        logger.warning(f"AI error fallback: {e}")
        reply = ("Here are quick tips: 1) Set a budget per category. 2) Lock the venue first. "
                 "3) Book photography & catering 3-6 months ahead. Ask me for vendor suggestions in your city!")
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

# --- Payments (Razorpay or mock) ---
@api.post("/payments/order")
async def create_payment_order(body: PayOrderIn, u: dict = Depends(require_role("customer"))):
    b = await db.bookings.find_one({"id": body.booking_id, "customer_id": u["id"]}, {"_id": 0})
    if not b: raise HTTPException(404, "Booking not found")
    amount_paise = b["amount"] * 100
    if PAYMENT_MODE == "live" and RAZORPAY_KEY_ID:
        import razorpay
        rzp = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        order = rzp.order.create({"amount": amount_paise, "currency": "INR",
                                  "receipt": b["id"], "payment_capture": 1})
        oid = order["id"]
    else:
        oid = f"order_mock_{uuid.uuid4().hex[:14]}"
    await db.bookings.update_one({"id": b["id"]}, {"$set": {"razorpay_order_id": oid}})
    return {"order_id": oid, "amount": amount_paise, "currency": "INR",
            "razorpay_key_id": RAZORPAY_KEY_ID or "rzp_test_mock",
            "mode": PAYMENT_MODE}

@api.post("/payments/verify")
async def verify_payment(body: PayVerifyIn, u: dict = Depends(require_role("customer"))):
    b = await db.bookings.find_one({"id": body.booking_id, "customer_id": u["id"]})
    if not b: raise HTTPException(404)
    if PAYMENT_MODE == "live" and RAZORPAY_KEY_ID:
        import razorpay
        rzp = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        try:
            rzp.utility.verify_payment_signature({
                "razorpay_order_id": body.razorpay_order_id,
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_signature": body.razorpay_signature,
            })
        except Exception:
            raise HTTPException(400, "Signature mismatch")
    await db.bookings.update_one({"id": body.booking_id}, {"$set": {
        "payment_status": "paid", "status": "confirmed",
        "razorpay_payment_id": body.razorpay_payment_id}})
    return {"success": True}

# --- KYC ---
@api.post("/kyc")
async def submit_kyc(body: KycIn, u: dict = Depends(require_role("vendor"))):
    doc = {"id": str(uuid.uuid4()), "vendor_id": u["vendor_id"], "user_id": u["id"],
           **body.dict(), "status": "pending",
           "submitted_at": datetime.now(timezone.utc).isoformat()}
    await db.kyc.insert_one(doc.copy())
    # auto-approve for demo
    await db.vendors.update_one({"id": u["vendor_id"]}, {"$set": {"verified": True}})
    return {"status": "approved", "kyc_id": doc["id"]}

@api.get("/kyc/me")
async def my_kyc(u: dict = Depends(require_role("vendor"))):
    k = await db.kyc.find_one({"vendor_id": u["vendor_id"]}, {"_id": 0})
    return k or {"status": "not_submitted"}

# --- Vendor self (services, dashboard) ---
@api.get("/vendor/me")
async def my_vendor(u: dict = Depends(require_role("vendor"))):
    v = await db.vendors.find_one({"id": u["vendor_id"]}, {"_id": 0})
    return _vendor_pub(v, v["city"]) if v else None

@api.patch("/vendor/me")
async def update_my_vendor(body: dict, u: dict = Depends(require_role("vendor"))):
    allowed = {"name", "category", "city", "cover", "gallery", "description",
               "starting_price", "facilities", "event_types", "address", "phone"}
    upd = {k: v for k, v in body.items() if k in allowed}
    await db.vendors.update_one({"id": u["vendor_id"]}, {"$set": upd})
    v = await db.vendors.find_one({"id": u["vendor_id"]}, {"_id": 0})
    return _vendor_pub(v, v["city"])

@api.get("/vendor/dashboard")
async def vendor_dashboard(u: dict = Depends(require_role("vendor"))):
    vid = u["vendor_id"]
    total = await db.bookings.count_documents({"vendor_id": vid})
    pending = await db.bookings.count_documents({"vendor_id": vid, "status": "pending"})
    confirmed = await db.bookings.count_documents({"vendor_id": vid, "status": "confirmed"})
    completed = await db.bookings.count_documents({"vendor_id": vid, "status": "completed"})
    pipeline = [{"$match": {"vendor_id": vid, "payment_status": "paid"}},
                {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}]
    agg = await db.bookings.aggregate(pipeline).to_list(1)
    revenue = agg[0]["sum"] if agg else 0
    v = await db.vendors.find_one({"id": vid}, {"_id": 0})
    return {"total_bookings": total, "pending": pending, "confirmed": confirmed,
            "completed": completed, "revenue": revenue,
            "views": (hash(vid) % 500) + 120, "inquiries": (hash(vid) % 80) + 25,
            "rating": v.get("rating", 0) if v else 0,
            "reviews_count": v.get("reviews_count", 0) if v else 0,
            "verified": v.get("verified", False) if v else False}

@api.get("/vendor/availability")
async def get_availability(u: dict = Depends(require_role("vendor"))):
    a = await db.availability.find_one({"vendor_id": u["vendor_id"]}, {"_id": 0})
    return a or {"vendor_id": u["vendor_id"], "blocked_dates": [], "max_per_day": 1}

@api.post("/vendor/availability")
async def set_availability(body: dict, u: dict = Depends(require_role("vendor"))):
    blocked = body.get("blocked_dates", [])
    max_pd = int(body.get("max_per_day", 1))
    await db.availability.update_one({"vendor_id": u["vendor_id"]},
        {"$set": {"vendor_id": u["vendor_id"], "blocked_dates": blocked, "max_per_day": max_pd}},
        upsert=True)
    return {"blocked_dates": blocked, "max_per_day": max_pd}

@api.get("/vendor/services")
async def list_services(u: dict = Depends(require_role("vendor"))):
    return await db.services.find({"vendor_id": u["vendor_id"]}, {"_id": 0}).to_list(100)

@api.post("/vendor/services")
async def add_service(body: ServiceIn, u: dict = Depends(require_role("vendor"))):
    doc = {"id": str(uuid.uuid4()), "vendor_id": u["vendor_id"], **body.dict(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.services.insert_one(doc.copy())
    return doc

@api.delete("/vendor/services/{sid}")
async def delete_service(sid: str, u: dict = Depends(require_role("vendor"))):
    await db.services.delete_one({"id": sid, "vendor_id": u["vendor_id"]})
    return {"ok": True}

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
    ("EventCraft Planners Mumbai", "planning", "Mumbai", 150000, 4.7, "Full-service wedding planners with global vendors.", ["End-to-End", "Destination", "Coordination"]),
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
        docs.append({
            "id": vid, "owner_id": owner_id, "name": name, "category": cat, "city": city,
            "cover": imgs[0], "gallery": imgs,
            "description": desc, "starting_price": price, "rating": rating,
            "reviews_count": (hash(name) % 80) + 12, "verified": True,
            "facilities": facilities,
            "event_types": ["wedding", "sangeet", "reception"] if cat in ("venues","decor","music") else ["wedding","corporate","birthday"],
            "address": f"{name}, {city}", "phone": f"+9199{10000000+i}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await db.vendors.insert_many(docs)
    # Combos
    for c in SEED_COMBOS:
        await db.combos.update_one({"id": c["id"]}, {"$set": c}, upsert=True)
    # Demo customer
    if not await db.users.find_one({"email": "customer.demo@eventpro.in"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "name": "Demo Customer",
            "email": "customer.demo@eventpro.in", "phone": "+919999999999",
            "password_hash": hash_pw("Demo@123"), "role": "customer",
            "city": "Hyderabad",
            "avatar": "https://ui-avatars.com/api/?name=Demo+Customer&background=D4AF37&color=0B0C10",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    logger.info("Seeding complete — %d vendors, %d combos", len(docs), len(SEED_COMBOS))

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.vendors.create_index("category")
    await db.bookings.create_index("customer_id")
    await db.bookings.create_index("vendor_id")
    await seed()

@app.on_event("shutdown")
async def on_shutdown():
    mongo.close()

app.include_router(api)
