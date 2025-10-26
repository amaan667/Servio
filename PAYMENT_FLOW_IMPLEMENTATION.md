# Payment Flow Implementation Guide

## Overview
This document explains how the three payment methods work in the system: **Pay Now**, **Pay Later**, and **Pay at Till**.

---

## Core Logic

### **COMPLETED = Order Fully Done**
- ✅ Food prepared
- ✅ Food served to customer
- ✅ **Payment collected**
- ✅ Customer left
- 🎯 **Table automatically clears when order marked COMPLETED**

### **Rule**: Orders can ONLY be marked COMPLETED if payment is collected

---

## Payment Flow #1: Pay Now (Stripe/Online) 💳

### Customer Journey:
1. **Customer orders** → Pays immediately via Stripe (Google Pay/Apple Pay/Card)
2. **Kitchen prepares** → Order status: `IN_PREP`
3. **Food ready** → Order status: `READY` (KDS marks ready)
4. **Waiter serves** → Order status: `SERVING`
5. **Waiter completes** → Order status: `COMPLETED` → **Table clears immediately**

### UI Flow (Live Orders):
```
IN_PREP     → [Preparing in Kitchen...] (not clickable)
READY       → [Mark Served] button
SERVING     → [✓ Paid - Mark Completed] button (green)
COMPLETED   → Table cleared
```

### Database:
```typescript
order_status: "IN_PREP" → "READY" → "SERVING" → "COMPLETED"
payment_status: "PAID" (from start)
payment_mode: "online"
payment_method: "stripe"
```

---

## Payment Flow #2: Pay Later 📱

### Customer Journey:
1. **Customer orders** → Chooses "Pay Later" (no payment yet)
2. **Kitchen prepares** → Order status: `IN_PREP`
3. **Food ready** → Order status: `READY`
4. **Waiter serves** → Order status: `SERVING`
5. ⏳ **Waiter CANNOT mark completed** (payment not collected)
6. **Customer rescans QR code** → Pays via Stripe on their phone
7. **After payment webhook** → Payment status: `PAID`
8. **NOW waiter can mark completed** → Order status: `COMPLETED` → **Table clears**

### UI Flow (Live Orders):
```
IN_PREP     → [Preparing in Kitchen...] (not clickable)
READY       → [Mark Served] button
SERVING     → [⏳ Awaiting Customer Payment] message
            → Shows: "Customer can rescan QR code to pay"
            → Payment link displayed for staff
            → (Waiter cannot mark completed yet)

After customer pays via QR:
SERVING     → [✓ Paid - Mark Completed] button (green)
COMPLETED   → Table cleared
```

### Customer Payment Page:
- **URL**: `https://your-site.com/pay-later/[orderId]`
- **Features**:
  - Shows order summary (items, total)
  - "Pay £X.XX Now" button
  - Redirects to Stripe checkout
  - After payment: Returns to order summary page
  - Webhook updates order payment_status to PAID

### Database:
```typescript
// Initial state
order_status: "IN_PREP" → "READY" → "SERVING"
payment_status: "UNPAID"
payment_mode: "pay_later"

// After customer rescans and pays
payment_status: "UNPAID" → "PAID"
payment_method: "stripe"

// Then staff can complete
order_status: "SERVING" → "COMPLETED"
```

---

## Payment Flow #3: Pay at Till 🏪

### Customer Journey:
1. **Customer orders** → Chooses "Pay at Till" (no payment yet)
2. **Kitchen prepares** → Order status: `IN_PREP`
3. **Food ready** → Order status: `READY`
4. **Waiter serves** → Order status: `SERVING`
5. ⏳ **Waiter CANNOT mark completed** (payment not collected)
6. **Waiter clicks "Collect Payment at Till"** button
7. **Payment dialog opens** → Waiter selects Cash or Card
8. **Waiter confirms payment** → Payment status: `PAID`
9. **NOW order can be completed** → Order status: `COMPLETED` → **Table clears**

### UI Flow (Live Orders):
```
IN_PREP     → [Preparing in Kitchen...] (not clickable)
READY       → [Mark Served] button
SERVING     → [⚠️ Payment Required at Till]
            → Shows: "Unpaid - £X.XX" badge
            → [Collect Payment at Till] button (purple)

Click "Collect Payment at Till":
→ Dialog opens showing:
  - Order summary
  - Items list
  - Total amount
  - Payment method selection: [Cash] or [Card]
  - [Confirm Payment] button

After confirming payment:
SERVING     → [✓ Paid - Mark Completed] button (green)
COMPLETED   → Table cleared
```

### Payment Collection Dialog:
- **Features**:
  - Shows order number, customer name
  - Lists all items
  - Displays total amount prominently
  - Two buttons: Cash or Card
  - Staff selects payment method
  - Clicks "Confirm Payment"
  - Order payment_status updates to PAID

### Database:
```typescript
// Initial state
order_status: "IN_PREP" → "READY" → "SERVING"
payment_status: "UNPAID"
payment_mode: "pay_at_till"

// After staff collects payment
payment_status: "UNPAID" → "PAID"
payment_method: "cash" or "card"

// Then staff can complete
order_status: "SERVING" → "COMPLETED"
```

---

## Table Clearing Logic

### Automatic Table Clearing:
- **Triggers**: When order status changes to `COMPLETED`
- **Endpoint**: `/api/orders/complete` (POST)
- **Actions**:
  1. Updates order status to `COMPLETED`
  2. Clears `table_sessions`:
     - Sets `status = "FREE"`
     - Sets `order_id = null`
     - Sets `closed_at = now()`

### Important:
- **ONLY** clears table when order is `COMPLETED`
- Order can **ONLY** be marked `COMPLETED` if `payment_status = "PAID"`
- This ensures tables don't clear before payment is collected

---

## API Endpoints

### 1. `/api/orders/[orderId]/collect-payment` (POST)
**Purpose**: Staff marks payment as collected for "pay_at_till" orders

**Request Body**:
```json
{
  "payment_method": "cash" | "card" | "till",
  "venue_id": "venue-xxx"
}
```

**Response**:
```json
{
  "ok": true,
  "order": { /* updated order */ },
  "message": "Payment collected successfully"
}
```

**Validations**:
- Order must exist
- Order must be "pay_at_till" mode
- Order must not be already paid

---

### 2. `/api/orders/complete` (POST)
**Purpose**: Mark order as completed and clear table

**Request Body**:
```json
{
  "orderId": "order-xxx",
  "venueId": "venue-xxx"
}
```

**Response**:
```json
{
  "ok": true,
  "order": { /* completed order */ }
}
```

**Actions**:
- Updates order status to `COMPLETED`
- Clears table session (sets to FREE)
- Removes order_id from table_sessions

---

### 3. `/pay-later/[orderId]` (Page)
**Purpose**: Customer-facing payment page for "pay_later" orders

**Features**:
- Displays order summary
- Shows all items and total
- "Pay £X.XX Now" button
- Redirects to Stripe checkout
- Links back to order summary after payment

**Validations**:
- Order must exist
- Order must be "pay_later" mode
- Order must not be already paid

---

## Testing Guide

### Test Case 1: Pay Now (Stripe)
1. ✅ Create order → Pay via Stripe
2. ✅ Verify order shows "Preparing in Kitchen..."
3. ✅ KDS marks ready → Verify shows "Mark Served" button
4. ✅ Click "Mark Served" → Verify shows "Mark Completed" button (green, says "✓ Paid")
5. ✅ Click "Mark Completed" → Verify table clears in Table Management
6. ✅ Verify order moves to History

---

### Test Case 2: Pay Later (Customer Pays)
1. ✅ Create order → Choose "Pay Later"
2. ✅ Verify order shows "Preparing in Kitchen..."
3. ✅ KDS marks ready → Click "Mark Served"
4. ✅ Verify shows "⏳ Awaiting Customer Payment" message (not clickable)
5. ✅ Copy payment link from UI: `/pay-later/[orderId]`
6. ✅ Open link in new tab (customer perspective)
7. ✅ Verify order summary shows correctly
8. ✅ Click "Pay £X.XX Now" → Complete Stripe payment
9. ✅ Return to Live Orders → Verify now shows "Mark Completed" button (green)
10. ✅ Click "Mark Completed" → Verify table clears
11. ✅ Verify order moves to History

---

### Test Case 3: Pay at Till (Staff Collects)
1. ✅ Create order → Choose "Pay at Till"
2. ✅ Verify order shows "Preparing in Kitchen..."
3. ✅ KDS marks ready → Click "Mark Served"
4. ✅ Verify shows "⚠️ Payment Required at Till" message
5. ✅ Verify shows "Collect Payment at Till" button (purple)
6. ✅ Click "Collect Payment at Till" → Dialog opens
7. ✅ Verify dialog shows:
   - Order number
   - Customer name
   - Items list
   - Total amount
   - Payment method buttons (Cash/Card)
8. ✅ Select "Cash" → Click "Confirm Payment"
9. ✅ Verify dialog closes
10. ✅ Verify now shows "Mark Completed" button (green, says "✓ Paid")
11. ✅ Click "Mark Completed" → Verify table clears
12. ✅ Verify order moves to History

---

## Error Handling

### Common Errors:

**1. "Order must be SERVING to mark as COMPLETED"**
- **Cause**: Trying to complete order before serving
- **Fix**: Click "Mark Served" first

**2. "This order does not support pay later"**
- **Cause**: Accessing `/pay-later/[orderId]` for non-pay-later order
- **Fix**: Check order's payment_mode in database

**3. "Order has already been paid"**
- **Cause**: Trying to collect payment twice
- **Fix**: Check order's payment_status before showing payment UI

**4. "This endpoint is only for 'pay_at_till' orders"**
- **Cause**: Calling collect-payment API for wrong payment mode
- **Fix**: Verify order's payment_mode before calling API

---

## Database Schema Notes

### Orders Table:
```sql
order_status: "IN_PREP" | "READY" | "SERVING" | "COMPLETED"
payment_status: "PAID" | "UNPAID"
payment_mode: "online" | "pay_at_till" | "pay_later"
payment_method: "stripe" | "cash" | "card" | "till"
```

### Table Sessions:
```sql
status: "FREE" | "OCCUPIED" | "RESERVED"
order_id: uuid (null when free)
closed_at: timestamp (set when order completed)
```

---

## Key Files

1. **`/app/api/orders/[orderId]/collect-payment/route.ts`**
   - Endpoint for staff to mark till payments as collected

2. **`/app/pay-later/[orderId]/page.tsx`**
   - Customer-facing payment page for pay_later orders

3. **`/components/orders/PaymentCollectionDialog.tsx`**
   - Dialog component for staff to collect till payments

4. **`/components/orders/OrderCard.tsx`**
   - Updated to show correct buttons based on payment status/mode

5. **`/app/api/orders/complete/route.ts`**
   - Marks order as completed and clears tables

---

## Summary

### **Payment Method Decision Tree**:

```
Customer orders →
  ├─ Pay Now (Stripe)
  │   └─ Payment collected upfront
  │       └─ Can complete immediately after serving
  │           └─ Table clears
  │
  ├─ Pay Later
  │   └─ Payment NOT collected
  │       └─ Cannot complete after serving
  │           └─ Customer rescans QR → Pays via Stripe
  │               └─ Webhook updates to PAID
  │                   └─ NOW can complete
  │                       └─ Table clears
  │
  └─ Pay at Till
      └─ Payment NOT collected
          └─ Cannot complete after serving
              └─ Staff clicks "Collect Payment at Till"
                  └─ Selects Cash/Card → Confirms
                      └─ Updates to PAID
                          └─ NOW can complete
                              └─ Table clears
```

### **Critical Rule**:
**COMPLETED = Served + Paid → Table Clears**

No exceptions. Payment must be collected before marking completed.

---

## Next Steps

1. ✅ Deploy to Railway
2. 🧪 Test all three payment flows
3. 📊 Monitor webhook logs for pay_later orders
4. 🐛 Fix any edge cases found during testing
5. 📱 Generate QR codes for pay_later links (optional enhancement)

---

## Questions?

If you encounter any issues:
1. Check Railway logs for webhook errors
2. Verify order's `payment_mode` and `payment_status` in database
3. Ensure table_sessions are being cleared correctly
4. Test Stripe webhook is firing for pay_later payments

