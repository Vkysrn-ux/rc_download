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
- Login supports **Password** or **OTP** (email).
- If SMTP isn’t configured (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`), the server logs the verification link / OTP code.

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
  - `RC_API_BASE_URL`
  - `RC_API_KEY` (sent as `Authorization: Bearer ...`)
- Surepass payload used by this app: `POST { "id_number": "MH12AB1234" }`

## Admin

- Create a normal account via `/signup`, verify the email, then promote it in MySQL:
  - Example: `UPDATE users SET role='admin', email_verified_at=NOW() WHERE email='admin@example.com';`
- Admin can approve pending wallet recharges at `/admin/payments`.
