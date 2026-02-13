# Kgomong Monitor

Kgomong Monitor helps a tavern team track:

- Products and selling prices
- Stock received from suppliers
- Stock adjustments (spillage, breakage, freebies, corrections)
- Customer credit accounts (sales and payments)
- Direct sales (cash/card/EFT) with product-level units
- Daily sales and cash difference report

## 1) Setup (Windows)

1. Copy `.env.example` to `.env.local`
2. Fill in:
   - `MONGODB_URI`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `ALLOWED_USER_EMAILS` (comma-separated whitelist)
   - Optional WhatsApp alerts:
     - `WHATSAPP_ACCESS_TOKEN`
     - `WHATSAPP_PHONE_NUMBER_ID`
     - `WHATSAPP_TO_PHONE` (single recipient)
     - `WHATSAPP_TO_PHONES` (optional comma-separated recipients)
     - `WHATSAPP_API_VERSION` (optional, default `v20.0`)
     - `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (for callback verification)

3. Install deps:

   ```bash
   npm install
   ```

4. Run:

   ```bash
   npm run dev
   ```

Open http://localhost:3000

## 2) Daily workflow (for non-technical users)

Use this order each day:

1. Go to `Products & Prices` and confirm products/prices are correct.
2. Go to `Stock Purchases` and capture any supplier invoices.
3. During the day, use:
   - `Customer Accounts` for credit sales and payments.
   - `Customer Accounts` > `Add Direct Sale` for cash/card/EFT sales.
   - `Stock Adjustments` for losses/gains (spillage, breakage, etc.).
4. Go to `Daily Overview` to review totals, differences, trends, and recommendations.

Stock is tracked automatically from:
- Purchases (+)
- Sales from direct sales and customer account charges (-)
- Adjustments (+/-)

No manual opening/closing stock counts are required.

## 3) Clerk requirements

This app uses Clerk Organizations so every record is scoped by `orgId`.

- Middleware is configured using `clerkMiddleware()`.
- API routes require an authenticated user + active org.
- Admin-only actions check `has({ role: 'org:admin' })`.

## 4) Access control (whitelist)

- Set `ALLOWED_USER_EMAILS` in `.env.local`.
- Only email addresses in that list can access protected pages and API routes.
- If the list is empty, whitelist checks are disabled.
- Example:
  - `ALLOWED_USER_EMAILS=owner@example.com,staff1@example.com`

## 5) Barcode scanning in purchases

- Go to `Stock Purchases`.
- In `Record Purchase`, use the `Scan Barcode` input.
- Scan and press Enter (or click `Add`).
- Each scan adds 1 single unit for that product.
- Make sure each product has a barcode set in `Products & Prices`.

## 6) API endpoints

All endpoints are under `/app/api`.

- `GET /api/health`
- `GET/POST /api/products`
- `POST /api/prices` (set price effective from date; auto-closes previous)
- `GET/POST /api/suppliers`
- `GET/POST /api/purchases`
- `POST /api/adjustments`
- `GET/POST /api/customers`
- `POST /api/tabs/charge`
- `POST /api/tabs/payment`
- `POST /api/sales` (direct cash/card/EFT sale with product lines)
- `GET /api/reports/daily?date=YYYY-MM-DD`
- `GET/PATCH /api/alerts`
- `POST /api/alerts/resend-failed`
- `GET /api/whatsapp/activity`
- `GET/POST /api/whatsapp/webhook` (Meta WhatsApp callback endpoint)

## 7) Glossary

- `Customer account`: Credit account where sales increase balance and payments reduce balance.
- `Stock adjustment`: Manual correction for stock gained or lost outside normal sales/purchases.
- `Direct sale`: Immediate sale paid by cash/card/EFT, captured with product line items.

## 8) Suggested next steps

- Add file uploads for invoices/deposit slips/receipts (Attachments + S3)
- Add locking rules (auto-lock after close, owner unlock with reason)
- Add WhatsApp/Email daily summary (variance + low stock)
