# Servio Payment & Table Logic Implementation Summary

## Architecture / Flow Summary

### Payment Modes

#### 1. Pay Now (Stripe)
- **Flow:** Customer selects "Pay Now" → Order created with `payment_mode: "online"`, `payment_status: "UNPAID"` → Stripe checkout → Webhook marks `payment_status: "PAID"`, `payment_method: "stripe"`
- **Status:** ✅ Working correctly
- **Files:**
  - `app/payment/hooks/usePaymentProcessing.ts:86-121`
  - `app/api/stripe/create-customer-checkout/route.ts`
  - `app/api/stripe/webhook/route.ts`

#### 2. Pay Later (Stripe via QR)
- **Flow:** Customer selects "Pay Later" → Order created with `payment_mode: "pay_later"`, `payment_status: "UNPAID"` → Customer rescans QR → System detects unpaid orders → Shows table payment screen → Stripe checkout for all unpaid orders → Webhook marks all orders as `PAID`
- **Status:** ✅ Implemented
- **Key Changes:**
  - Fixed `/api/pay/later/route.ts` to keep `payment_status: "UNPAID"` (not `"PAY_LATER"`)
  - Added `/api/orders/table/[tableNumber]/unpaid-for-payment` endpoint
  - Added `/api/stripe/create-table-checkout` for multiple orders
  - Updated webhook to handle table-level payments
  - Added `TablePaymentScreen` component
  - Updated `useOrderSession` to detect unpaid table orders on QR rescan
- **Files:**
  - `app/api/pay/later/route.ts` (FIXED)
  - `app/api/orders/table/[tableNumber]/unpaid-for-payment/route.ts` (NEW)
  - `app/api/stripe/create-table-checkout/route.ts` (NEW)
  - `app/api/stripe/webhook/route.ts` (UPDATED)
  - `components/payment/TablePaymentScreen.tsx` (NEW)
  - `app/payment/table/page.tsx` (NEW)
  - `app/order/hooks/useOrderSession.ts` (UPDATED)

#### 3. Pay at Till
- **Flow:** Customer selects "Pay at Till" → Order created with `payment_mode: "pay_at_till"`, `payment_status: "UNPAID"` → Staff collects payment → `PaymentCollectionDialog` → `/api/orders/[orderId]/collect-payment` → Marks `payment_status: "PAID"`, `payment_method: "cash"` or `"card"`
- **Table-Level:** Staff can pay entire table using `TablePaymentDialog` → `/api/orders/pay-multiple`
- **Status:** ✅ Working correctly
- **Files:**
  - `components/orders/PaymentCollectionDialog.tsx`
  - `components/orders/TablePaymentDialog.tsx`
  - `app/api/orders/[orderId]/collect-payment/route.ts`
  - `app/api/orders/pay-multiple/route.ts`

### Order Status Flow

```
PLACED → ACCEPTED → IN_PREP → READY → SERVED → COMPLETED
```

**Rules:**
- Order can only be COMPLETED if `payment_status = "PAID"` AND `order_status = "SERVED"`
- KDS/Live Orders drives status changes (IN_PREP, READY)
- FOH/staff marks SERVED and COMPLETED

### Table Payment Model

**Aggregation:**
- Fetch unpaid orders: `WHERE table_number = X AND payment_status = 'UNPAID' AND created_at >= today_start`
- Group by `payment_mode` for warnings
- Filter out already-paid orders

**Payment Flows:**
1. **Pay Entire Table (Till):** `TablePaymentDialog` → `/api/orders/pay-multiple`
2. **Pay Entire Table (Stripe):** `TablePaymentScreen` → `/api/stripe/create-table-checkout` → Webhook updates all orders
3. **Split Bill:** `BillSplittingDialog` → `/api/pos/bill-splits`
4. **Single Order:** `PaymentCollectionDialog` → `/api/orders/[orderId]/collect-payment`

### QR Rescan Behavior

**On QR Scan (`/order?venue=X&table=Y`):**
1. Extract `venue_id` and `table_number` from URL
2. Check localStorage for existing session (backward compatibility)
3. **NEW:** Fetch all unpaid orders for table from database
4. **If unpaid orders exist:**
   - Redirect to `/payment/table?venue=X&table=Y`
   - Show `TablePaymentScreen` with:
     - List of unpaid orders
     - Total amount
     - "Pay All" button (Stripe)
5. **If no unpaid orders:**
   - Show normal order menu

## File-by-File Changes

### Fixed Files

1. **`app/api/pay/later/route.ts`**
   - **Change:** Fixed to keep `payment_status: "UNPAID"` instead of setting `"PAY_LATER"`
   - **Reason:** `payment_status` should only be `"PAID"`, `"UNPAID"`, `"REFUNDED"`, or `"PARTIALLY_PAID"`. Payment mode is tracked via `payment_mode`.

2. **`app/payment/hooks/usePaymentProcessing.ts`**
   - **Change:** Standardized `payment_mode` to use `"online"` for Stripe payments
   - **Reason:** Consistency - all Stripe payments use `"online"` mode

3. **`app/api/orders/table/[tableNumber]/unpaid/route.ts`**
   - **Change:** Removed `"PAY_LATER"` from payment_status filter (now only `"UNPAID"`)
   - **Reason:** `payment_status` should never be `"PAY_LATER"`

4. **`app/api/stripe/webhook/route.ts`**
   - **Change:** Added support for table-level payments (multiple orders)
   - **Reason:** Webhook needs to handle both single and table-level Stripe payments

5. **`app/order/hooks/useOrderSession.ts`**
   - **Change:** Added logic to detect unpaid table orders on QR rescan
   - **Reason:** Customers should see unpaid orders when rescannning QR, not just localStorage session

### New Files

1. **`app/api/orders/table/[tableNumber]/unpaid-for-payment/route.ts`**
   - **Purpose:** Fetch unpaid orders for customer payment screen (QR rescan)
   - **Returns:** Orders with payment mode breakdown

2. **`app/api/stripe/create-table-checkout/route.ts`**
   - **Purpose:** Create Stripe checkout session for multiple orders (table payment)
   - **Metadata:** Stores comma-separated order IDs

3. **`components/payment/TablePaymentScreen.tsx`**
   - **Purpose:** Customer-facing screen to pay all unpaid orders for a table
   - **Features:** Lists orders, shows total, "Pay All" button

4. **`app/payment/table/page.tsx`**
   - **Purpose:** Page route for table payment screen
   - **URL:** `/payment/table?venue=X&table=Y`

5. **`PAYMENT_TABLE_LOGIC_AUDIT.md`**
   - **Purpose:** Discovery document documenting current state

6. **`PAYMENT_IMPLEMENTATION_SUMMARY.md`**
   - **Purpose:** This file - final implementation summary

## New Behavior Examples

### Example 1: Table 10, Three Orders, Mixed Payment Modes

**Scenario:**
- Order #1: `pay_now`, `PAID` (already paid online)
- Order #2: `pay_later`, `UNPAID`
- Order #3: `pay_at_till`, `UNPAID`

**When Customer Rescans QR:**
1. System detects 2 unpaid orders (Order #2 and #3)
2. Redirects to `/payment/table?venue=X&table=10`
3. Shows `TablePaymentScreen` with:
   - Order #2 (£25.00, pay_later)
   - Order #3 (£30.00, pay_at_till)
   - Total: £55.00
   - Warning: "Mixed payment modes"
4. Customer clicks "Pay All" → Stripe checkout for £55.00
5. After payment, webhook marks both orders as `PAID`
6. Staff can now mark orders as COMPLETED

**When Staff Uses "Pay Entire Table":**
1. Staff sees Order #2 and #3 in Live Orders
2. Clicks "Pay Entire Table" on Order #2
3. `TablePaymentDialog` shows both unpaid orders
4. Staff selects "cash" or "card"
5. Both orders marked as `PAID` via `/api/orders/pay-multiple`

### Example 2: Multiple Customers, Same Table, Pay Later

**Scenario:**
- Person A scans QR → Places Order #1 (`pay_later`, `UNPAID`)
- Person B scans QR → Places Order #2 (`pay_later`, `UNPAID`)
- Person C scans QR → Places Order #3 (`pay_later`, `UNPAID`)

**When Person A Rescans QR Later:**
1. System detects all 3 unpaid orders
2. Shows `TablePaymentScreen` with all 3 orders
3. Person A can pay all 3 orders in one transaction
4. After payment, all orders marked as `PAID`
5. Person B and C see "All Bills Settled" if they rescan

### Example 3: Pay at Till with Multiple Orders

**Scenario:**
- Table 5 has 3 unpaid orders (`pay_at_till`)

**Staff Flow:**
1. Staff sees Order #1 in Live Orders
2. Clicks "Pay Entire Table"
3. `TablePaymentDialog` shows all 3 orders (£45.00 total)
4. Staff selects "card"
5. All 3 orders marked as `PAID` with `payment_method: "card"`
6. Staff can now mark orders as COMPLETED

## Edge Cases Handled

1. **Already Paid Orders:** All endpoints filter out `PAID` orders
2. **Mixed Payment Modes:** Table payment shows warning but allows payment
3. **No Unpaid Orders:** Shows "All Bills Settled" message
4. **Different Devices:** QR rescan checks database, not just localStorage
5. **Multiple Orders Same Table:** Aggregates correctly, shows combined total
6. **Webhook Idempotency:** Checks for existing `stripe_session_id` before updating

## Follow-Up Suggestions

### Future Improvements

1. **Partial Table Payments:** Allow customers to select which orders to pay (not just "all")
2. **Per-Person Bill Splitting:** Customer-side bill splitting UI
3. **Combined Receipts:** Generate single receipt for table-level payments showing all orders
4. **Better Table Grouping:** Enhanced filters/grouping in Live Orders for tables with multiple orders
5. **Payment History:** Show payment history per table/session
6. **Refund Support:** Handle refunds for table-level payments

### Testing Recommendations

1. **Unit Tests:** Payment mode validation, order aggregation logic
2. **Integration Tests:** Table payment flow end-to-end, webhook handling
3. **E2E Tests:** QR rescan → payment → webhook → order status update

## Consistency Notes

- ✅ All payment modes use consistent `payment_status` values (`UNPAID` → `PAID`)
- ✅ `payment_mode` values standardized: `"online"`, `"pay_at_till"`, `"pay_later"`
- ✅ Table-level payment works for both Stripe and Till
- ✅ Receipts show logo only (no venue name text)
- ✅ Theme colors extracted from logo
- ✅ Order status flow includes `SERVED` state
- ✅ Real-time updates via Supabase subscriptions

