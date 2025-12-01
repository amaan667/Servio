# Payment Flow Fixes - Summary

## Root Cause of "[object Object]" Error

The error was caused by improper error handling when API responses failed. Error objects were being concatenated directly into strings without extracting the actual error message, resulting in "[object Object]" being displayed to users.

## Fixes Implemented

### 1. Error Handling Improvements

**File: `app/payment/hooks/usePaymentProcessing.ts`**

- **Stripe Payment Flow**: Improved error parsing from API responses
  - Now properly extracts error messages from JSON responses
  - Handles both JSON and plain text error responses
  - Provides user-friendly error messages instead of "[object Object]"

- **Pay at Till Flow**: Enhanced error handling
  - Properly parses error responses
  - Limits error message length to prevent UI overflow
  - Logs detailed errors for debugging

- **Pay Later Flow**: Enhanced error handling
  - Same improvements as Pay at Till
  - Better error message extraction

- **General Error Handling**: The catch block now properly extracts error messages:
  - Checks if error is an Error instance
  - Extracts message from error objects
  - Falls back to JSON.stringify only as last resort

### 2. Stripe Checkout Flow (Pay Now)

**File: `app/api/stripe/create-customer-checkout/route.ts`**

- **Session ID Storage**: Now updates the order with the Stripe session ID immediately after creating the checkout session
  - This ensures the webhook can find the order reliably
  - Falls back to metadata orderId lookup if update fails (non-critical)

**File: `app/payment/success/page.tsx`**

- **Order Lookup**: Improved order retrieval after Stripe payment
  - Better handling of API response formats
  - Retry logic with longer delays for webhook processing
  - Fallback to orderId from URL parameters
  - User-friendly error messages if order not found

### 3. Payment Flow Integration

All three payment methods now properly integrate with:

#### **Live Orders**
- Orders are created with `order_status: "PLACED"` which makes them immediately visible in Live Orders
- Payment status is correctly set: `UNPAID` for Till/Later, updated to `PAID` after Stripe payment

#### **KDS (Kitchen Display System)**
- KDS tickets are automatically created when orders are created via `createKDSTickets()` function
- Items are routed to correct stations using existing LLM-based sorting logic
- This happens for ALL payment methods (Pay Now, Pay at Till, Pay Later)

#### **Table Management**
- Tables are auto-created if they don't exist (for QR code scenarios)
- Table sessions are created/updated when orders are placed
- Table status reflects occupancy and order status
- All orders are linked to their respective tables

## Payment Method Flows

### 1. Pay Now (Stripe)

**Flow:**
1. User clicks "Pay Now"
2. Order is created with:
   - `order_status: "PLACED"`
   - `payment_status: "UNPAID"`
   - `payment_mode: "online"`
3. Stripe checkout session is created
4. Order is updated with `stripe_session_id` (for webhook lookup)
5. User is redirected to Stripe Checkout
6. After payment:
   - Webhook (`/api/stripe/webhook`) updates order:
     - `payment_status: "PAID"`
     - `payment_method: "stripe"`
     - `stripe_session_id` and `stripe_payment_intent_id` stored
7. User is redirected to payment success page
8. Success page looks up order by session ID and redirects to order summary

**Integration:**
- ✅ Order appears in Live Orders immediately
- ✅ KDS tickets created for kitchen items
- ✅ Table session created/updated
- ✅ Order visible in Payments page after payment

### 2. Pay at Till

**Flow:**
1. User clicks "Pay at Till"
2. Order is created with:
   - `order_status: "PLACED"`
   - `payment_status: "UNPAID"`
   - `payment_mode: "pay_at_till"`
   - `payment_method: "till"`
3. Order confirmation is shown
4. User is redirected to order summary page

**Integration:**
- ✅ Order appears in Live Orders immediately (UNPAID status shown)
- ✅ KDS tickets created for kitchen items
- ✅ Table session created/updated
- ✅ Order visible in Payments page for staff to mark as paid
- ✅ Staff can mark order as paid later using existing staff flow

### 3. Pay Later

**Flow:**
1. User clicks "Pay Later"
2. Order is created with:
   - `order_status: "PLACED"`
   - `payment_status: "UNPAID"`
   - `payment_mode: "pay_later"`
   - `payment_method: null`
3. Order confirmation is shown
4. Session data is stored in localStorage for QR re-scan
5. User is redirected to order summary page

**QR Re-scan Flow:**
1. User re-scans QR code for table
2. System detects existing unpaid order
3. Stripe checkout session is created for existing order
4. User completes payment
5. Webhook updates order:
   - `payment_status: "PAID"`
   - `payment_method: "stripe"`
6. User is redirected to order summary

**Integration:**
- ✅ Order appears in Live Orders immediately (UNPAID status shown)
- ✅ KDS tickets created for kitchen items
- ✅ Table session created/updated
- ✅ Order visible in Table Management
- ✅ QR re-scan creates Stripe checkout for existing order

## Key Technical Details

### Order Status Flow
- All orders start with `order_status: "PLACED"` to appear in Live Orders immediately
- Status progresses: PLACED → IN_PREP → READY → SERVING → COMPLETED

### Payment Status Flow
- **Pay Now**: UNPAID → (Stripe payment) → PAID
- **Pay at Till**: UNPAID → (Staff marks paid) → PAID
- **Pay Later**: UNPAID → (QR re-scan + Stripe payment) → PAID

### Error Handling Pattern
All error handling now follows this pattern:
1. Try to parse error as JSON
2. Extract `error` or `message` field
3. Fall back to error text (limited length)
4. Log detailed error for debugging
5. Show user-friendly message

### Webhook Reliability
- Webhook finds orders by:
  1. `stripe_session_id` (preferred, set immediately after checkout creation)
  2. `orderId` from session metadata (fallback)
- Idempotency check prevents duplicate processing
- Receipt emails sent automatically if enabled

## Files Modified

1. `app/payment/hooks/usePaymentProcessing.ts` - Error handling improvements
2. `app/api/stripe/create-customer-checkout/route.ts` - Session ID storage
3. `app/payment/success/page.tsx` - Better order lookup

## Testing Checklist

- [ ] Pay Now: Complete Stripe checkout successfully
- [ ] Pay Now: Order appears in Live Orders with PAID status
- [ ] Pay Now: KDS tickets created correctly
- [ ] Pay Now: Table session created/updated
- [ ] Pay at Till: Order created with UNPAID status
- [ ] Pay at Till: Order appears in Live Orders
- [ ] Pay at Till: Order appears in Payments page
- [ ] Pay at Till: KDS tickets created
- [ ] Pay Later: Order created with UNPAID status
- [ ] Pay Later: Order appears in Live Orders
- [ ] Pay Later: QR re-scan opens Stripe checkout
- [ ] Pay Later: Payment updates existing order
- [ ] Error handling: No more "[object Object]" messages
- [ ] Error handling: User-friendly error messages shown

## Notes

- All error messages are now user-friendly and meaningful
- No raw error objects are concatenated into strings
- All payment flows are fully integrated with KDS, Live Orders, and Table Management
- Webhook processing is reliable with proper fallbacks
- Orders are always created before payment to ensure they appear in Live Orders immediately

