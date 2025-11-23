# Servio Payment & Table Logic Audit

## Step 1: Current State Discovery

### Payment Mode Types

**Current Implementation:**
- `payment_mode`: `"online"` | `"pay_at_till"` | `"pay_later"` (from `usePaymentProcessing.ts:39`)
- `payment_status`: `"PAID"` | `"UNPAID"` | `"PAY_LATER"` | `"REFUNDED"` | `"PARTIALLY_PAID"` (from `types/order.ts:15`)
- `payment_method`: `"demo"` | `"stripe"` | `"till"` | `"cash"` | `"card"` | `null` (from `types/order.ts:17`)

**Inconsistencies Found:**
1. `payment_status` includes `"PAY_LATER"` but should be `"UNPAID"` with `payment_mode = "pay_later"`
2. `/api/pay/later/route.ts:77` sets `payment_status: "PAY_LATER"` - WRONG, should be `"UNPAID"`
3. `payment_mode` values inconsistent: sometimes `"online"`, sometimes `"pay_now"`

### Payment Mode Flows

#### 1. Pay Now (Stripe)
**Location:** `app/payment/hooks/usePaymentProcessing.ts:86-121`
- Creates order with `payment_mode: "online"`, `payment_status: "UNPAID"`
- Redirects to Stripe checkout
- Webhook (`app/api/stripe/webhook/route.ts:79-89`) updates `payment_status: "PAID"`, `payment_method: "stripe"`
- ✅ **Status:** Working correctly

#### 2. Pay Later
**Location:** `app/payment/hooks/usePaymentProcessing.ts:160-214`
- Creates order with `payment_mode: "pay_later"`, `payment_status: "UNPAID"`
- Stores session in localStorage
- ❌ **Issue:** `/api/pay/later/route.ts:77` incorrectly sets `payment_status: "PAY_LATER"` instead of keeping `"UNPAID"`
- ❌ **Issue:** QR rescan logic (`app/order/hooks/useOrderSession.ts`) only checks for single order in localStorage, not all unpaid orders for table
- ❌ **Issue:** No logic to fetch all unpaid `pay_later` orders for a table when QR is rescanned

#### 3. Pay at Till
**Location:** `app/payment/hooks/usePaymentProcessing.ts:122-159`
- Creates order with `payment_mode: "pay_at_till"`, `payment_status: "UNPAID"`
- Staff collects payment via `PaymentCollectionDialog` → `/api/orders/[orderId]/collect-payment`
- ✅ **Status:** Working correctly for single orders
- ✅ **Status:** Table-level payment exists (`TablePaymentDialog` + `/api/orders/pay-multiple`)

### Table-Level Payment

**Current Implementation:**
- ✅ `TablePaymentDialog` exists (`components/orders/TablePaymentDialog.tsx`)
- ✅ `/api/orders/table/[tableNumber]/unpaid` exists - fetches unpaid orders for table
- ✅ `/api/orders/pay-multiple` exists - pays multiple orders at once
- ✅ `OrderCard.tsx` shows "Pay Entire Table" button when 2+ unpaid orders exist
- ✅ Handles mixed payment modes (shows warning)
- ✅ Skips already-paid orders

**Missing:**
- ❌ QR rescan doesn't show table-level payment option for `pay_later` orders
- ❌ No Stripe checkout for multiple orders (only till payment supports table-level)

### QR Rescan Logic

**Current:** `app/order/hooks/useOrderSession.ts:54-195`
- Checks localStorage for single order
- Redirects to `/payment` if unpaid order found
- ❌ **Issue:** Only handles single order from localStorage
- ❌ **Issue:** Doesn't fetch all unpaid orders for table from database
- ❌ **Issue:** Payment page doesn't detect table-level unpaid orders

### Receipt Logic

**Current:**
- ✅ Single order receipts work (`components/receipt/ReceiptModal.tsx`)
- ✅ Logo-only receipts (no venue name)
- ✅ Theme colors from logo
- ❌ **Missing:** Combined/table-level receipts showing all orders

### Bill Splitting

**Current:**
- ✅ `BillSplittingDialog` exists (`components/pos/BillSplittingDialog.tsx`)
- ✅ `/api/pos/bill-splits` endpoint exists
- ⚠️ **Status:** Not fully integrated into Live Orders/OrderCard flow

## Step 2: Design - Correct Flows

### State Machine

```
order_status: PLACED → ACCEPTED → IN_PREP → READY → SERVED → COMPLETED
payment_status: UNPAID → PAID (or REFUNDED)
payment_mode: "online" | "pay_at_till" | "pay_later"
payment_method: "stripe" | "cash" | "card" | "till" | null
```

**Rules:**
- `payment_status` should NEVER be `"PAY_LATER"` - use `"UNPAID"` with `payment_mode = "pay_later"`
- `payment_mode` should be `"online"` for Stripe payments (not `"pay_now"`)
- Order can only be COMPLETED if `payment_status = "PAID"` AND `order_status = "SERVED"`

### Table Payment Model

**Aggregation:**
- Fetch unpaid orders: `WHERE table_number = X AND payment_status IN ('UNPAID', 'PAY_LATER') AND created_at >= today_start`
- Group by `payment_mode` for warnings
- Filter out already-paid orders

**Payment Flows:**
1. **Pay Entire Table (Till):** Use `TablePaymentDialog` → `/api/orders/pay-multiple`
2. **Pay Entire Table (Stripe):** NEW - Create Stripe checkout for combined total → webhook updates all orders
3. **Split Bill:** Use `BillSplittingDialog` → `/api/pos/bill-splits`
4. **Single Order:** Use `PaymentCollectionDialog` → `/api/orders/[orderId]/collect-payment`

### QR Rescan Behavior

**On QR Scan (`/order?venue=X&table=Y`):**
1. Extract `venue_id` and `table_number` from URL
2. Check localStorage for existing session (backward compatibility)
3. **NEW:** Fetch all unpaid orders for table from database
4. **If unpaid orders exist:**
   - Show payment screen with:
     - List of unpaid orders
     - Total amount
     - Option to "Pay All" (Stripe)
     - Option to "Pay Individual Orders" (future)
5. **If no unpaid orders:**
   - Show normal order menu

## Step 3: Implementation Tasks

### 3.1 Fix Pay Later API
- Fix `/api/pay/later/route.ts` to NOT set `payment_status: "PAY_LATER"`
- Keep `payment_status: "UNPAID"` and set `payment_mode: "pay_later"`

### 3.2 Implement QR Rescan Table Payment
- Update `useOrderSession.ts` to fetch unpaid orders for table
- Create new payment screen component for table-level payment
- Update `/api/stripe/create-customer-checkout` to accept multiple order IDs
- Update webhook to mark multiple orders as PAID

### 3.3 Fix Payment Mode Consistency
- Standardize `payment_mode` values: `"online"` (not `"pay_now"`)
- Update all order creation to use consistent values

### 3.4 Implement Combined Receipts
- Create table receipt component
- Update receipt generation to handle multiple orders

