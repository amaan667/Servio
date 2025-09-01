# Order Insertion Fix Guide

## Problem Summary
The order insertion is failing due to database schema mismatches:
1. `table_number` column is defined as `TEXT` but code tries to insert `INTEGER`
2. Missing `order_status` column or incorrect status values
3. Dashboard showing incorrect counts due to data inconsistencies

## Solution Steps

### 1. Fix Database Schema
Run the following SQL script in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of scripts/fix-database-schema.sql
```

This script will:
- Convert `table_number` from TEXT to INTEGER
- Add missing `order_status` column
- Update `payment_status` constraints
- Migrate existing data
- Create proper indexes

### 2. Clear Test Data (Optional)
If you want to start fresh, run:

```sql
-- Copy and paste the contents of scripts/clear-test-data.sql
```

### 3. Test Order Creation
After running the schema fix:

1. Go to the customer ordering UI
2. Add items to cart
3. Complete the payment process
4. Check if the order appears in the live orders dashboard

### 4. Verify Dashboard Counts
The dashboard should now show accurate counts:
- Active tables: Tables with orders not marked as COMPLETED
- Unpaid orders: Orders with payment_status = 'UNPAID'
- Today's orders: Orders created today (excluding CANCELLED)

## Debugging

### Check Order Creation Logs
Look for these debug messages in the browser console:
- `[ORDER CREATION DEBUG] Creating order with data:`
- `[ORDER CREATION DEBUG] Calculated total:`
- `[ORDER CREATION DEBUG] Order created successfully:`

### Check Database State
Run this query to verify the schema:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('table_number', 'order_status', 'payment_status')
ORDER BY column_name;
```

### Check Existing Orders
Run this query to see current order counts:

```sql
SELECT 
    COUNT(*) as total_orders,
    COUNT(CASE WHEN order_status = 'PLACED' THEN 1 END) as placed_orders,
    COUNT(CASE WHEN payment_status = 'UNPAID' THEN 1 END) as unpaid_orders,
    COUNT(CASE WHEN order_status NOT IN ('COMPLETED', 'CANCELLED') THEN 1 END) as active_orders
FROM orders;
```

## Expected Results

After applying the fix:
1. ✅ Order insertion should work without errors
2. ✅ Dashboard should show accurate counts
3. ✅ Live orders page should display new orders
4. ✅ No more "insert failed" messages

## Files Modified

- `lib/supabase.ts` - Enhanced error logging
- `app/payment/page.tsx` - Better error handling
- `scripts/fix-database-schema.sql` - Database schema fix
- `scripts/clear-test-data.sql` - Data cleanup script

## Next Steps

1. Run the database schema fix
2. Test order creation
3. Verify dashboard accuracy
4. Deploy changes if needed
