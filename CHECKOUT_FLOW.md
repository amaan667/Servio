# Complete Checkout Flow Documentation

## ✅ All Three Payment Methods Working Flawlessly

### 1. **Pay Now (Stripe)** 💳

**Flow:**
1. Customer clicks "Pay Now"
2. Frontend calls `/api/stripe/create-checkout-session`
3. Creates Stripe checkout session with order metadata
4. **Immediately redirects to Stripe payment page**
5. Customer pays on Stripe
6. Stripe webhook (`/api/stripe/webhooks`) processes payment
7. Order updated to `payment_status: 'PAID'`
8. Customer redirected to success page

**Logs in Railway:**
```
💳 [STRIPE CHECKOUT] Creating Stripe checkout session
  orderId: "uuid..."
  amount: 25.50
  venueName: "Your Restaurant"
```

**Status:** ✅ Working - Direct Stripe redirect

---

### 2. **Pay at Till** 🏪

**Flow:**
1. Customer clicks "Pay at Till"
2. Frontend calls `/api/pay/till` with order_id
3. Backend updates order:
   - `payment_status: 'TILL'`
   - `payment_method: 'till'`
4. **Order immediately sent to kitchen** (appears in Live Orders/KDS)
5. **Order appears in Table Management** with "Pay at Till" badge
6. Staff can see the order and collect payment physically
7. Staff marks payment received in dashboard

**Logs in Railway:**
```
💳 [PAY TILL] Payment at till requested
  orderId: "uuid..."

✅ [PAY TILL] Order marked for till payment successfully
  orderId: "uuid..."
  tableNumber: 5
  total: 25.50
  orderNumber: #1234
```

**Status:** ✅ Working - Order sent to table management

---

### 3. **Pay Later** ⏰ (Re-Scan to Pay)

**Flow:**
1. Customer clicks "Pay Later"
2. Frontend calls `/api/pay/later` with order_id and sessionId
3. Backend updates order:
   - `payment_status: 'PAY_LATER'` ← **FIXED** (was 'UNPAID')
   - `payment_method: 'later'`
4. **Session stored in localStorage** with order details
5. **Order sent to kitchen** (appears in Live Orders/KDS)
6. Customer can leave and come back

**Re-Scan Behavior:**
7. Customer scans same QR code again from **same device**
8. `useOrderSession` checks localStorage for session
9. Finds order with `payment_status: 'PAY_LATER'`
10. **Automatically redirects to /payment page**
11. Shows Stripe payment option
12. Customer completes payment online

**Logs in Railway:**
```
⏰ [PAY LATER] Pay later requested
  orderId: "uuid..."
  sessionId: "session_123..."

✅ [PAY LATER] Order marked as pay later successfully
  orderId: "uuid..."
  tableNumber: 5
  total: 25.50
  orderNumber: #1234
  note: "Customer can re-scan QR to pay online"

[On re-scan]
🔍 [QR SCAN - SERVER] Order page accessed via QR code
  venueSlug: "your-venue"
  tableNumber: "5"

🔍 [ORDER SESSION] Checking existing order in DB
  orderId: "uuid..."

✅ [ORDER SESSION] Redirecting to payment
  orderId: "uuid..."
```

**Status:** ✅ Working - Re-scan brings up Stripe payment

---

## 🔍 Why 503 Errors Were Happening

**Problem:**
- Customers are **anonymous** (no login required)
- Direct Supabase queries hit **RLS (Row Level Security)** policies
- RLS blocked unauthenticated queries → 503 Service Unavailable

**Solution:**
- Created `/api/orders/check-active` endpoint
- Uses **service role key** (bypasses RLS)
- Customers query via API, not direct Supabase
- **5 retry attempts** with exponential backoff

---

## 📊 Payment Status Flow Chart

```
Customer Scans QR → Places Order → Chooses Payment:

├─ Pay Now
│  └─ Redirect to Stripe → Pay → Webhook → PAID → Done
│
├─ Pay at Till  
│  └─ Confirm Order → TILL status → Kitchen + Table Mgmt → Staff collects payment
│
└─ Pay Later
   └─ Confirm Order → PAY_LATER status → Kitchen → Store session
      └─ Re-scan QR → Detect session → Redirect to /payment → Stripe checkout
```

---

## 🎯 What Shows in Table Management

**Pay at Till Orders:**
- ✅ Immediately visible
- Badge: "Pay at Till"
- Status: Can be served/completed
- Staff marks payment when collected

**Pay Later Orders:**
- ✅ Immediately visible
- Badge: "Pay Later"
- Status: Can be served
- If customer re-scans and pays online → status updates to PAID

---

## 🔐 Security

All payment endpoints use **service role** to bypass RLS:
- Customers don't need to authenticate
- Secure because orders are tied to QR code/table
- Stripe handles actual payment security
- Webhook signature verification on payment completion

---

## ✅ Verification Checklist

- [x] Pay Now → Stripe redirect working
- [x] Pay at Till → Appears in table management
- [x] Pay Later → Order confirmed, session stored
- [x] Re-scan Pay Later → Redirects to payment
- [x] All flows logged to Railway
- [x] 503 errors eliminated
- [x] Plan display shows "Active - Paid" correctly
- [x] Retry logic handles transient failures

**Status: All checkout flows working flawlessly!** 🎉

