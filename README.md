# Tavern Monitor Starter (Stock + Cash + Tabs)

This is a starter **Next.js App Router + Clerk + MongoDB (Mongoose)** project to implement:
- Products + price history
- Purchases (stock-in)
- Business day open/close + stock counts
- Adjustments (spillage/freebies/breakage/etc)
- Till close (cash/card/EFT + expenses + deposits + cash counted)
- Tabs/Credit (customer ledger: charges + payments)
- Daily variance report: **stock-inferred sales vs collected sales + tab charges**

## 1) Setup (Windows)
1. Copy `.env.example` to `.env.local`
2. Fill in:
   - `MONGODB_URI`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

3. Install deps:
```bash
npm install
```

4. Run:
```bash
npm run dev
```

Open http://localhost:3000

## 2) Clerk requirements
This starter expects you to use Clerk Organizations so every record is scoped by `orgId`.
- Middleware is configured using `clerkMiddleware()`.
- API routes require an authenticated user + active org.
- Admin-only actions check `has({ role: 'org:admin' })`.

## 3) What’s implemented (MVP endpoints)
All endpoints are under `/app/api`.
- `GET /api/health`
- `GET/POST /api/products`
- `POST /api/prices` (set price effective from date; auto-closes previous)
- `GET/POST /api/suppliers`
- `GET/POST /api/purchases`
- `POST /api/business-days/open`
- `POST /api/business-days/close`
- `POST /api/stock-counts` (OPEN or CLOSE counts)
- `POST /api/adjustments`
- `POST /api/till-closes`
- `GET/POST /api/customers`
- `POST /api/tabs/charge`
- `POST /api/tabs/payment`
- `GET /api/reports/daily?date=YYYY-MM-DD`

## 4) Suggested next steps
- Add file uploads for invoices/deposit slips/receipts (Attachments + S3)
- Add locking rules (auto-lock after close, owner unlock with reason)
- Add UI forms for staff flows (purchases, close stock, close till, tab charge/payment)
- Add WhatsApp/Email daily summary (variance + low stock)

---
Generated as a starter scaffold: keep it tiny, then harden the workflows.
