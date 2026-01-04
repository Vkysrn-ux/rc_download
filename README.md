# RC Download App

## Setup

1. Install deps: `npm install`
2. Create MySQL schema:
   - Create a database (e.g. `rc_download_app`)
   - Run `db/schema.sql`
3. Configure env:
   - Copy `.env.example` to `.env.local`
   - Fill `DB_*` and `AUTH_JWT_SECRET` (login will fail if missing)
4. Run the app: `npm run dev`

## Email verification + OTP

- Signup sends an email verification link.
- Login supports **Password**, **OTP** (email), or **Phone OTP** (Firebase).
- If SMTP isn’t configured (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`), the server logs the verification link / OTP code.

## Phone OTP (Firebase)

- Configure env vars in `.env.local` (see `.env.example`): `NEXT_PUBLIC_FIREBASE_*` + `FIREBASE_*`.
- If you already created tables before this change, run a one-time migration:
  - `ALTER TABLE users ADD COLUMN phone VARCHAR(32) NULL, ADD COLUMN phone_verified_at DATETIME NULL;`
  - `ALTER TABLE users ADD UNIQUE KEY uniq_users_phone (phone);`

## Payment (UPI)

- Configure:
  - `PAYMENT_UPI_ID`
  - `PAYMENT_PAYEE_NAME` (optional)
  - `PAYMENT_QR_URL` (optional, defaults to `/payment-qr.png`)
  - `PAYMENT_AUTO_APPROVE` (`true` to immediately mark payments completed and auto-credit wallet)

## Payment (Razorpay)

- Configure:
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
- If you already created tables before this change, run a one-time migration:
  - `ALTER TABLE transactions MODIFY payment_method ENUM('wallet','upi','razorpay') NULL;`
  - `ALTER TABLE transactions ADD COLUMN gateway VARCHAR(32) NULL, ADD COLUMN gateway_order_id VARCHAR(64) NULL, ADD COLUMN gateway_payment_id VARCHAR(64) NULL, ADD COLUMN gateway_signature VARCHAR(255) NULL;`
  - `CREATE INDEX idx_tx_gateway_order ON transactions(gateway_order_id);`

## RC API integration

- Default is mock mode (`RC_API_MODE=mock`).
- To use your provider, set:
  - `RC_API_MODE=external`
  - `RC_API_BASE_URL` + `RC_API_KEY` (sent as `Authorization: Bearer ...`)
  - Optional failover providers (tried automatically if one fails): `RC_API_BASE_URL_2`/`RC_API_KEY_2`, `RC_API_BASE_URL_3`/`RC_API_KEY_3`
  - Optional final fallback (tried only if providers 1–3 fail): `RC_API_APNIRC_B2B_AUTHORIZATION` (sent as `Authorization: <value>`) and optional `RC_API_APNIRC_B2B_URL` (defaults to `https://api.apnirc.xyz/api/b2b/get-rc`)
  - Optional timeout: `RC_API_TIMEOUT_MS` (default `15000`)
- Surepass payload used by this app: `POST { "id_number": "MH12AB1234" }`
  - APNIRC B2B fallback payload: `POST { "vrn": "MH12AB1234" }`

## Admin

- Create a normal account via `/signup`, verify the email, then promote it in MySQL:
  - Example: `UPDATE users SET role='admin', email_verified_at=NOW() WHERE email='admin@example.com';`
- Admin can approve pending wallet recharges at `/admin/payments`.
