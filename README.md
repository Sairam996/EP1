# Here are your Instructions

## Local setup & security

1. `cp backend/.env.example backend/.env` and fill in values (generate a `KYC_ENCRYPTION_KEY` with the command in the file). Never commit `.env`.
2. Start MongoDB bound to `127.0.0.1` with auth: `MONGO_ROOT_USER=thara MONGO_ROOT_PASSWORD=<strong> docker compose up -d mongo`, and set `MONGO_URL=mongodb://thara:<strong>@127.0.0.1:27017/?authSource=admin`.
3. Demo data (vendors with known passwords) only loads when `ENABLE_DEMO_SEED=true` — never enable in production.
4. Browser origins are restricted by `CORS_ORIGINS`; access tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 120, no refresh token yet — users log in again).
5. KYC PAN/GST/document URL are Fernet-encrypted at rest; vendors see masked values, admins read them via `GET /api/admin/vendors/{id}/kyc` with `X-Admin-Secret`.
6. Login (10/min/IP), register (5/min/IP) and uploads (30/min/user) are rate limited in-memory (per process).
