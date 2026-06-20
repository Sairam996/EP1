# EventPro — Product Requirements (Phase 1 MVP, shipped)

## Vision
India's premium D2C marketplace for event services (weddings, sangeet, birthdays, corporate) — Swiggy/Zomato District × Urban Company. Gold-on-black luxe aesthetic.

## Tech Stack
- **Frontend**: React Expo (React Native) + expo-router, gold (#D4AF37) / dark luxe theme
- **Backend**: FastAPI + MongoDB (Motor) + JWT auth
- **AI**: GPT-5.2 via Emergent Universal LLM Key
- **Payments**: Razorpay (mock mode for MVP, ready to flip live with `PAYMENT_MODE=live` + real keys)

## Roles
- **Customer**: discover, book, chat, pay, review
- **Vendor**: dashboard, manage services, accept/reject bookings, availability, KYC

## Phase 1 Features (DONE)
### Customer
- Login/Signup with role toggle
- Home: city picker, hero carousel, 10 event types, 6 categories, trending vendors, 3 combo packages
- Search with category filters & live results
- Vendor detail: gallery, About/Reviews/Gallery tabs, facilities, similar vendors, sticky Book Now
- Booking form → checkout → Razorpay (mock) UPI success
- My Bookings list with status badges; booking detail with star-review submit
- Customer ↔ vendor chat (polling every 4s)
- "Ask AI" floating button → multi-turn event-planning chat (gpt-5.2)
- Favorites toggle
- Profile + sign out

### Vendor
- Dashboard tiles (views, inquiries, bookings, revenue, status counts)
- Bookings Inbox with Accept/Reject/Mark-Completed/Chat
- Services CRUD
- Availability calendar (blocked dates + max-per-day)
- KYC submit → auto-approved verified badge

### Backend APIs
`/api/auth/{register,login,me}` · `/api/vendors[?city&category&event_type&q&trending]` · `/api/vendors/{id}{,/similar,/reviews}` · `/api/bookings` (CRUD + role-aware) · `/api/reviews` · `/api/favorites` · `/api/chat/{threads,messages,messages/{bid}}` · `/api/ai/chat` · `/api/payments/{order,verify}` · `/api/kyc` · `/api/vendor/{me,dashboard,services,availability}` · `/api/{categories,event-types,cities,combos}`

## Seeded Demo Data
- 20 verified vendors across Hyderabad / Mumbai / Delhi / Bangalore (5 categories)
- 3 combo packages
- 1 demo customer (`customer.demo@eventpro.in` / `Demo@123`)
- 20 vendor admins (`vendorN@eventpro.in` / `Vendor@123`)

## Phase 2 Backlog (not built)
- Real Razorpay live mode (flip env when keys provided)
- WebSocket chat (currently 4s polling)
- Google Maps live navigation + GPS
- Firebase push notifications
- Multi-language (Hindi/Telugu/Tamil)
- Referrals & loyalty
- Admin moderation panel
