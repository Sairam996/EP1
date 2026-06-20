# EventPro — Product Requirements

## Vision
India's premium D2C marketplace for event services (weddings, sangeet, birthdays, corporate) — Swiggy/Zomato District × Urban Company. Gold-on-black luxe aesthetic.

## Tech Stack
- **Frontend**: React Expo + expo-router, gold (#D4AF37) / dark luxe theme
- **Backend**: FastAPI + MongoDB (Motor) + JWT auth + WebSockets
- **AI**: GPT-5.2 via Emergent Universal LLM Key
- **Payments**: Razorpay (mock mode by default; flip env to live + add keys to go live)

## Phase 1 (Shipped)
Customer: discover → vendor → book → pay → review → chat → favorites · AI assistant · Vendor: dashboard, bookings inbox, services, availability, KYC.

## Phase 2 (Shipped — this iteration)
1. **Razorpay real code path** in `/api/payments/{order,verify}` — toggle `PAYMENT_MODE=live` + add real `RAZORPAY_KEY_ID`/`SECRET` to go live.
2. **WebSocket chat** at `/api/ws/chat/{booking_id}?token=JWT` with live "is typing…" indicator and live/connecting/offline status.
3. **GPS + Maps**: `expo-location` requests permission, sends lat/lng to backend; Haversine real distance from user; "Get Directions" button opens native maps app with vendor coords.
4. **Referrals & Loyalty**:
   - Every user gets a referral code (`EPxxxxxx`).
   - Friend signs up & uses code → both get **+200 points** instantly.
   - On every paid booking → customer earns **5% of paid amount** as points.
   - Redeem points at checkout: **1 pt = 1 INR**, capped at **20% of booking**.
   - Idempotent `/payments/verify` (no double-award if called twice).
5. **Vendor profile editor** at `/vendor-profile-edit`: edit business name, category, cover, gallery, description, starting price, address, phone, facilities — all updates persist via `PATCH /api/vendor/me`.

## Demo Data
- 20 verified vendors (Hyderabad/Mumbai/Delhi/Bangalore × 5 categories) with real lat/lng coordinates.
- 3 combo packages.
- Demo customer `customer.demo@eventpro.in` / `Demo@123` (referral code `EPDEMO1`, 500 starting points).
- Vendor admins `vendor1..20@eventpro.in` / `Vendor@123`.

## Backlog (Phase 3)
- Plug live Razorpay keys (env flip; checkout UI ready).
- Embedded Google Static Map preview on vendor detail (needs API key).
- Multi-language (Hindi/Telugu/Tamil) via i18next.
- Admin moderation panel.
- Refer-a-friend leaderboard / tiered loyalty (silver/gold/platinum).
- FCM push notifications (requires real device builds — not Expo Go).
