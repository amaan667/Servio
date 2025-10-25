# Stripe Webhooks Configuration

## 🎯 Two Separate Webhooks Required

Your app uses **TWO different webhook endpoints** for different purposes:

---

## 1️⃣ Customer Orders Webhook (QR Code Payments)

**Endpoint URL:**
```
https://servio-production.up.railway.app/api/stripe/webhook
```
(singular - no 's')

**Purpose:** Handles customer order payments from QR code scanning

**Events to listen for:**
- `checkout.session.completed`

**What it does:**
- Receives Stripe payment completion
- Creates order in database with:
  - Status: `IN_PREP`
  - Payment: `PAID`
  - Links order to `stripe_session_id`
- Order appears in Live Orders, KDS, Table Management

**Configure in Stripe Dashboard:**
1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. URL: `https://servio-production.up.railway.app/api/stripe/webhook`
4. Events: `checkout.session.completed`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_...`)
7. Add to Railway environment variable: `STRIPE_WEBHOOK_SECRET`

---

## 2️⃣ Subscriptions Webhook (Plans/Upgrades)

**Endpoint URL:**
```
https://servio-production.up.railway.app/api/stripe/webhooks
```
(plural - with 's')

**Purpose:** Handles subscription plan upgrades and billing

**Events to listen for:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**What it does:**
- Updates organization subscription tiers
- Handles subscription lifecycle
- Processes recurring billing

**Configure in Stripe Dashboard:**
1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. URL: `https://servio-production.up.railway.app/api/stripe/webhooks`
4. Events: Select all subscription events listed above
5. Click "Add endpoint"
6. Use the SAME signing secret: `STRIPE_WEBHOOK_SECRET`

---

## 🔑 Environment Variable

**Both webhooks use the SAME signing secret:**

```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

Add this in Railway → Variables tab

---

## ✅ How to Verify They're Working

### Test Customer Orders Webhook:
1. Make a test order on your venue's QR code page
2. Pay with Stripe test card: `4242 4242 4242 4242`
3. Check Railway logs for:
```
💳 [CUSTOMER ORDER WEBHOOK] WEBHOOK RECEIVED
✅ [CUSTOMER ORDER WEBHOOK] ORDER CREATED SUCCESSFULLY!
🆔 Order ID: abc123
```

### Test Subscriptions Webhook:
1. Upgrade a venue to Premium/Pro
2. Pay with Stripe
3. Check Railway logs for:
```
💼 [SUBSCRIPTION WEBHOOK] CHECKOUT COMPLETED
✅ Organization subscription updated
```

---

## 🐛 Troubleshooting

**"Payment successful but order not found"**
- Customer orders webhook not configured
- Check Railway logs - should see webhook logs
- Verify webhook URL is correct (singular `/webhook`)

**Orders created but subscription not updated**
- Subscriptions webhook not configured
- Verify webhook URL is correct (plural `/webhooks`)

**"Webhook signature verification failed"**
- Wrong `STRIPE_WEBHOOK_SECRET`
- Get signing secret from Stripe Dashboard
- Update Railway environment variable
- Redeploy

---

## 📊 Quick Reference

| Purpose | Endpoint | Events |
|---------|----------|--------|
| Customer Orders | `/api/stripe/webhook` | `checkout.session.completed` |
| Subscriptions | `/api/stripe/webhooks` | All subscription events |

**Both use the same:** `STRIPE_WEBHOOK_SECRET`

