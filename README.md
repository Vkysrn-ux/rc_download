# RC Download App

## Setup

1. Install deps: `npm install`
2. Create MySQL schema:
   - Create a database (e.g. `rc_download_app`)
   - Run `db/schema.sql`
   - If you already created tables before the phone field existed, run: `db/migrations/001_add_users_phone.sql`
3. Configure env:
   - Copy `.env.example` to `.env.local`
   - Fill `DB_*` and `AUTH_JWT_SECRET` (login will fail if missing)
4. Run the app: `npm run dev`

## Auth

- Signup asks for **Name, Email, Mobile number, Password**.
- Login supports **Email or Mobile number + Password**.
- Forgot password sends a one-time code to the user's email address.
- If SMTP isn’t configured (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`), the server logs the reset code.

## Payment (UPI)

- Configure:
  - `PAYMENT_UPI_ID`
  - `PAYMENT_PAYEE_NAME` (optional)
  - `PAYMENT_QR_URL` (optional, defaults to `/payment-qr.png`)
  - `PAYMENT_AUTO_APPROVE` (`true` to immediately mark payments completed and auto-credit wallet)
- Enable manual UPI flows:
  - `PAYMENTS_ENABLE_MANUAL_UPI=true`

## Payment (Cashfree)

- Configure:
  - `CASHFREE_CLIENT_ID`
  - `CASHFREE_CLIENT_SECRET`
  - `CASHFREE_ENV` (`sandbox` or `production`)
  - `CASHFREE_API_VERSION` (optional, default `2023-08-01`)
  - `APP_BASE_URL` (your public base URL, used for Cashfree return URL)
- Enable Cashfree flows:
  - `PAYMENTS_ENABLE_CASHFREE=true`

## Payment (Razorpay)

- Configure:
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
- Enable Razorpay flows:
  - `PAYMENTS_ENABLE_RAZORPAY=true`
- If you already created tables before this change, run a one-time migration:
  - `ALTER TABLE transactions MODIFY payment_method ENUM('wallet','upi','razorpay','cashfree') NULL;`
  - `ALTER TABLE transactions ADD COLUMN gateway VARCHAR(32) NULL, ADD COLUMN gateway_order_id VARCHAR(64) NULL, ADD COLUMN gateway_payment_id VARCHAR(64) NULL, ADD COLUMN gateway_signature VARCHAR(255) NULL;`
  - `CREATE INDEX idx_tx_gateway_order ON transactions(gateway_order_id);`

## RC API integration

- Default is mock mode (`RC_API_MODE=mock`).
- To use your provider, set:
  - `RC_API_MODE=external`
  - `RC_API_BASE_URL` + `RC_API_KEY` (sent as `Authorization: Bearer ...`)
  - Optional failover providers (tried automatically if one fails): `RC_API_BASE_URL_2`/`RC_API_KEY_2`, `RC_API_BASE_URL_3`/`RC_API_KEY_3`, `RC_API_BASE_URL_4`/`RC_API_KEY_4`
  - Optional final fallback (tried only if providers 1–3 fail): `RC_API_APNIRC_B2B_AUTHORIZATION` (sent as `Authorization: <value>`) and optional `RC_API_APNIRC_B2B_URL` (defaults to `https://api.apnirc.xyz/api/b2b/get-rc`)
  - Optional timeout: `RC_API_TIMEOUT_MS` (default `15000`)
- Surepass payload used by this app: `POST { "id_number": "MH12AB1234" }`
  - APNIRC B2B fallback payload: `POST { "vrn": "MH12AB1234" }`
- Optional provider overrides:
  - `RC_API_METHOD` / `RC_API_METHOD_2` / `RC_API_METHOD_3` / `RC_API_METHOD_4` (`GET` or `POST`, default `POST`)
  - `RC_API_HEADERS` / `RC_API_HEADERS_2` / `RC_API_HEADERS_3` / `RC_API_HEADERS_4` (JSON object of extra headers)
  - `RC_API_EXTRA_PARAMS` / `RC_API_EXTRA_PARAMS_2` / `RC_API_EXTRA_PARAMS_3` / `RC_API_EXTRA_PARAMS_4` (JSON object merged into query params for `GET` or body for `POST`)
  - `RC_API_SIGNATURE_PUBLIC_KEY_PATH` / `RC_API_SIGNATURE_PUBLIC_KEY_PATH_2` / `RC_API_SIGNATURE_PUBLIC_KEY_PATH_3` / `RC_API_SIGNATURE_PUBLIC_KEY_PATH_4` (PEM path for RSA signature)
  - `RC_API_SIGNATURE_HEADER_NAME` / `RC_API_SIGNATURE_HEADER_NAME_2` / `RC_API_SIGNATURE_HEADER_NAME_3` / `RC_API_SIGNATURE_HEADER_NAME_4` (header name to send signature)
  - `RC_API_SIGNATURE_TIMESTAMP_HEADER_NAME` / `RC_API_SIGNATURE_TIMESTAMP_HEADER_NAME_2` / `RC_API_SIGNATURE_TIMESTAMP_HEADER_NAME_3` / `RC_API_SIGNATURE_TIMESTAMP_HEADER_NAME_4` (optional timestamp header name)
- Example: Cashfree VRS (production, single provider):
  - `RC_API_MODE=external`
  - `RC_API_BASE_URL=https://api.cashfree.com/verification/vehicle-rc`
  - `RC_API_METHOD=POST`
  - `RC_API_AUTH_HEADER_NAME=x-client-id`
  - `RC_API_AUTH_SCHEME=` (empty)
  - `RC_API_KEY=your_client_id`
  - `RC_API_HEADERS={"x-client-secret":"your_client_secret"}`
  - `RC_API_PAYLOAD_FIELD=vehicle_number`
  - `RC_API_EXTRA_PARAMS={"verification_id":"AUTO"}`
  - If Cashfree requires RSA signature:
    - `RC_API_SIGNATURE_PUBLIC_KEY_PATH=path/to/cashfree_public_key.pem`
    - or inline: `RC_API_SIGNATURE_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----`
    - `RC_API_SIGNATURE_HEADER_NAME=<as-per-docs>`
    - `RC_API_SIGNATURE_TIMESTAMP_HEADER_NAME=<as-per-docs>`
  - Use `RC_API_EXTRA_PARAMS={"verification_id":"<your_verification_id>"}` if you want to control the ID.

## Admin

- Create a normal account via `/signup`, then promote it in MySQL:
  - Example: `UPDATE users SET role='admin' WHERE email='admin@example.com';`
- Admin can approve pending wallet recharges at `/admin/payments`.

## PDF download size (compression)

PDF downloads are generated client-side from a canvas snapshot. To reduce PDF size (e.g. avoid ~6MB PDFs), you can tune these optional env vars (all are `NEXT_PUBLIC_*`):

- `NEXT_PUBLIC_PDF_IMAGE_FORMAT` (`jpeg` or `png`, default `jpeg`)
- `NEXT_PUBLIC_PDF_JPEG_QUALITY` (`0.1`-`0.95`, default `0.7`, only for `jpeg`)
- `NEXT_PUBLIC_PDF_CAPTURE_SCALE` (`0.5`-`2`, default `1.25`; lower = smaller file)
- `NEXT_PUBLIC_PDF_COMPRESS` (`true`/`false`, default `true`)
- `NEXT_PUBLIC_PDF_IMAGE_COMPRESSION` (`NONE`/`FAST`/`MEDIUM`/`SLOW`, default `FAST`)
