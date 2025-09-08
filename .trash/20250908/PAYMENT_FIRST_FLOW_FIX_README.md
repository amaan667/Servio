# Payment-First Flow Fix

## Problem Description

The system was creating orders **before** payment was completed, which caused several issues:

- ❌ **Unpaid orders appearing in live orders dashboard**
- ❌ **Revenue counts including unpaid orders**
- ❌ **Order counts including unpaid orders**
- ❌ **Orders being registered before payment success**

## Root Cause

The original flow was:
1. Customer selects items → **Order created with `payment_status: 'UNPAID'`**
2. Customer redirected to payment page
3. Payment processed → Order updated to `payment_status: 'PAID'`

This meant unpaid orders were visible in the dashboard and counted in revenue/order statistics.

## Solution: Payment-First Flow

The new flow ensures orders are **only created after successful payment**:

1. Customer selects items → **Order data stored in localStorage**
2. Customer redirected to payment page
3. **Payment processed → Order created with `payment_status: 'PAID'`**
4. Order appears in live orders dashboard
5. Revenue and counts updated

## Files Modified

### **Application Changes**
1. **`app/order/page.tsx`** - Updated to store order data instead of creating orders
2. **`app/api/live-orders/route.ts`** - Only show paid orders
3. **`app/api/dashboard/orders/route.ts`** - Only show paid orders
4. **`app/api/dashboard/orders/one/route.ts`** - Only show paid orders
5. **`app/dashboard/[venueId]/orders/OrdersClient.tsx`** - Only show paid orders

### **Database Changes**
6. **`scripts/fix-dashboard-counts-paid-orders.sql`** - Updated dashboard counts function

### **Deployment Tools**
7. **`deploy-payment-first-flow.sh`** - Deployment script
8. **`PAYMENT_FIRST_FLOW_FIX_README.md`** - This documentation

## Key Changes Made

### **1. Order Creation Flow**
**Before:**
```javascript
// Order created immediately with UNPAID status
const response = await fetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify({
    ...orderData,
    payment_status: 'UNPAID' // ❌ Created before payment
  })
});
```

**After:**
```javascript
// Order data stored in localStorage, created after payment
localStorage.setItem('pending-order-data', JSON.stringify(orderData));
router.replace(`/order/${venueSlug}/${tableNumber}/payment`);
```

### **2. Live Orders API**
**Before:**
```javascript
// Showed all orders regardless of payment status
.eq('venue_id', venueId)
.in('order_status', ['PLACED', 'IN_PREP', 'READY'])
```

**After:**
```javascript
// Only show paid orders
.eq('venue_id', venueId)
.eq('payment_status', 'PAID') // ✅ Only paid orders
.in('order_status', ['PLACED', 'IN_PREP', 'READY'])
```

### **3. Dashboard Counts Function**
**Before:**
```sql
-- Counted all orders regardless of payment status
from public.orders o, b
where o.venue_id = p_venue_id
```

**After:**
```sql
-- Only count paid orders
from public.orders o, b
where o.venue_id = p_venue_id
  and o.payment_status = 'PAID' -- ✅ Only paid orders
```

## Deployment Instructions

### **Step 1: Apply Database Fix**
1. Go to your **Supabase Dashboard**
2. Open **SQL Editor** → **New query**
3. Copy and paste the contents of `scripts/fix-dashboard-counts-paid-orders.sql`
4. Click **Run**

### **Step 2: Deploy Application Changes**
Deploy your application with the updated code (all changes are already made).

### **Step 3: Verify the Fix**
1. **Create a test order** and complete payment
2. **Check live orders dashboard** - should only show paid orders
3. **Verify revenue counts** - should only include paid orders
4. **Check order counts** - should only include paid orders

## Benefits

### **✅ Accurate Revenue Tracking**
- Revenue counts only include successfully paid orders
- No more inflated revenue from unpaid orders

### **✅ Clean Live Orders Dashboard**
- Only shows orders that have been paid for
- No confusion about unpaid orders

### **✅ Accurate Order Counts**
- Order statistics only include paid orders
- Better business metrics

### **✅ Proper Payment Flow**
- Orders are only created after successful payment
- No abandoned unpaid orders in the system

## Technical Details

### **Payment Flow Comparison**

| Step | Before (❌) | After (✅) |
|------|-------------|------------|
| 1. Customer selects items | Order created with `UNPAID` | Order data stored in localStorage |
| 2. Customer enters details | Order visible in dashboard | Order data stored in localStorage |
| 3. Customer redirected | To summary page | To payment page |
| 4. Payment processed | Order updated to `PAID` | Order created with `PAID` |
| 5. Order appears in dashboard | Immediately (unpaid) | Only after payment success |

### **Database Queries Updated**

All order queries now include:
```sql
WHERE payment_status = 'PAID'
```

This ensures:
- Live orders API only returns paid orders
- Dashboard APIs only return paid orders
- Dashboard counts function only counts paid orders
- Revenue calculations only include paid orders

## Monitoring

After deployment, monitor for:
- ✅ No unpaid orders in live orders dashboard
- ✅ Revenue counts match actual paid orders
- ✅ Order counts match actual paid orders
- ✅ Payment flow works correctly
- ✅ No abandoned unpaid orders

## Rollback Plan

If issues occur:
1. **Revert application changes** to previous version
2. **Restore previous dashboard counts function** if needed
3. **Monitor for any new issues**

## Related Issues

This fix resolves:
- Unpaid orders appearing in dashboard
- Inaccurate revenue tracking
- Inaccurate order counts
- Orders being created before payment
- Business metrics including unpaid orders
