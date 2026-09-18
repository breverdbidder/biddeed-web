# 100 Pioneers — Stripe setup

## Offer (SSOT)
- Hard cap **100** (`pioneer_seats`)
- **$990/year recurring** subscription
- Grants **Pro** tier (not Investor)
- **Forever = rate lock** while subscribed; cancel → lose lock
- Year-1 cash at sellout ≈ **$99k**
- Do **not** reuse Investor annual price ID

## Stripe Dashboard
1. Products → Add product: **BidDeed 100 Pioneers — Pro (rate-locked)**
2. Price: **$990.00 / year**, recurring
3. Copy Price ID → `STRIPE_PRICE_PIONEER_PRO_ANNUAL=price_...`
4. Set `STRIPE_SECRET_KEY` on the web deploy
5. `npm install stripe` (add `stripe` to package.json dependencies)

## App routes
- `GET /api/pioneers/availability`
- `POST /api/pioneers/checkout`
- `POST /api/pioneers/confirm?session_id=cs_...`
- `GET /pioneers`
- `GET /pioneers/success`

## Fulfilment
Success page calls confirm → `fulfilPioneerCheckout` claims a seat, writes
`pioneer_subscriptions`, sets `mcp_customers.tier_id = pro`.
Checkout Session metadata: `campaign=100_pioneers`, `tier_id=pro`, `product=pioneer_pro`.
