# Supabase Migration Guide - Phase 1 Improvements

This guide provides the SQL commands to apply the Phase 1 migrations directly in Supabase.

## Prerequisites

1. Access to Supabase dashboard
2. Service role key (for admin operations)
3. Database access permissions

## Migration 1: Idempotency Keys Table

**Purpose**: Store idempotency keys to prevent duplicate API operations, especially for payments.

**Run in Supabase SQL Editor**:

```sql
-- Create idempotency_keys table
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  response_data JSONB NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create indexes for fast lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON public.idempotency_keys(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON public.idempotency_keys(expires_at);

-- Add comments
COMMENT ON TABLE public.idempotency_keys IS 'Stores idempotency keys for API operations to prevent duplicate processing';
COMMENT ON COLUMN public.idempotency_keys.idempotency_key IS 'Unique key for idempotent operations';
COMMENT ON COLUMN public.idempotency_keys.request_hash IS 'Hash of the request payload for validation';
COMMENT ON COLUMN public.idempotency_keys.response_data IS 'Cached response data for idempotent requests';
COMMENT ON COLUMN public.idempotency_keys.expires_at IS 'Expiration time for automatic cleanup';

-- Enable RLS
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (only service role can access)
CREATE POLICY "Service role can manage idempotency keys"
  ON public.idempotency_keys
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create cleanup function for expired keys
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check and store idempotency key
CREATE OR REPLACE FUNCTION public.check_idempotency_key(
  p_idempotency_key TEXT,
  p_request_hash TEXT
)
RETURNS TABLE (
  found BOOLEAN,
  response_data JSONB,
  status_code INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true,
    response_data,
    status_code
  FROM public.idempotency_keys
  WHERE idempotency_key = p_idempotency_key
    AND request_hash = p_request_hash
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::JSONB, NULL::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to store idempotency response
CREATE OR REPLACE FUNCTION public.store_idempotency_response(
  p_idempotency_key TEXT,
  p_request_hash TEXT,
  p_response_data JSONB,
  p_status_code INTEGER,
  p_ttl_hours INTEGER DEFAULT 24
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.idempotency_keys (
    idempotency_key,
    request_hash,
    response_data,
    status_code,
    expires_at
  )
  VALUES (
    p_idempotency_key,
    p_request_hash,
    p_response_data,
    p_status_code,
    NOW() + (p_ttl_hours || ' hours')::INTERVAL
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_idempotency_key TO service_role;
GRANT EXECUTE ON FUNCTION public.store_idempotency_response TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_idempotency_keys TO service_role;
```

**Verification**:
```sql
-- Check table exists
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'idempotency_keys';

-- Check indexes
SELECT * FROM pg_indexes 
WHERE tablename = 'idempotency_keys';

-- Check functions
SELECT * FROM pg_proc 
WHERE proname LIKE '%idempotency%';
```

---

## Migration 2: Atomic Order Creation

**Purpose**: Create orders atomically with order items and inventory deduction in a single transaction.

**Run in Supabase SQL Editor**:

```sql
-- Create atomic order creation function
CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_venue_id UUID,
  p_table_id UUID,
  p_table_number INTEGER,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_items JSONB,
  p_total_amount NUMERIC,
  p_payment_method TEXT,
  p_payment_mode TEXT,
  p_source TEXT,
  p_qr_type TEXT,
  p_fulfillment_type TEXT,
  p_requires_collection BOOLEAN DEFAULT false,
  p_notes TEXT DEFAULT NULL,
  p_order_number TEXT DEFAULT NULL,
  p_deduct_inventory BOOLEAN DEFAULT true
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_item JSONB;
  v_menu_item_id UUID;
  v_quantity INTEGER;
  v_price NUMERIC;
  v_inventory_item_id UUID;
  v_current_stock INTEGER;
  v_low_stock_threshold INTEGER;
  v_error_message TEXT;
BEGIN
  -- Start transaction
  BEGIN
    -- Generate order number if not provided
    IF p_order_number IS NULL THEN
      v_order_number := 'ORD-' || LPAD(NEXTVAL('public.order_number_seq')::TEXT, 6, '0');
    ELSE
      v_order_number := p_order_number;
    END IF;
    
    -- Create order
    INSERT INTO public.orders (
      venue_id,
      table_id,
      table_number,
      customer_name,
      customer_phone,
      customer_email,
      total_amount,
      payment_method,
      payment_mode,
      source,
      qr_type,
      fulfillment_type,
      requires_collection,
      notes,
      order_number,
      status,
      created_at
    )
    VALUES (
      p_venue_id,
      p_table_id,
      p_table_number,
      p_customer_name,
      p_customer_phone,
      p_customer_email,
      p_total_amount,
      p_payment_method,
      p_payment_mode,
      p_source,
      p_qr_type,
      p_fulfillment_type,
      p_requires_collection,
      p_notes,
      v_order_number,
      'PENDING',
      NOW()
    )
    RETURNING id INTO v_order_id;
    
    -- Create order items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_menu_item_id := (v_item->>'menu_item_id')::UUID;
      v_quantity := (v_item->>'quantity')::INTEGER;
      v_price := (v_item->>'price')::NUMERIC;
      
      INSERT INTO public.order_items (
        order_id,
        menu_item_id,
        quantity,
        price,
        special_instructions,
        created_at
      )
      VALUES (
        v_order_id,
        v_menu_item_id,
        v_quantity,
        v_price,
        v_item->>'special_instructions',
        NOW()
      );
      
      -- Deduct inventory if enabled
      IF p_deduct_inventory THEN
        -- Get inventory item for this menu item
        SELECT 
          ii.id,
          ii.current_stock,
          ii.low_stock_threshold
        INTO v_inventory_item_id, v_current_stock, v_low_stock_threshold
        FROM public.inventory_items ii
        JOIN public.menu_item_inventory mii ON ii.id = mii.inventory_item_id
        WHERE mii.menu_item_id = v_menu_item_id
          AND ii.venue_id = p_venue_id
        LIMIT 1;
        
        IF v_inventory_item_id IS NOT NULL THEN
          -- Check if enough stock
          IF v_current_stock >= v_quantity THEN
            -- Deduct stock
            UPDATE public.inventory_items
            SET 
              current_stock = current_stock - v_quantity,
              updated_at = NOW()
            WHERE id = v_inventory_item_id;
            
            -- Create inventory transaction
            INSERT INTO public.inventory_transactions (
              inventory_item_id,
              venue_id,
              order_id,
              quantity,
              transaction_type,
              notes,
              created_at
            )
            VALUES (
              v_inventory_item_id,
              p_venue_id,
              v_order_id,
              -v_quantity,
              'SALE',
              'Order: ' || v_order_number,
              NOW()
            );
            
            -- Check for low stock alert
            IF (v_current_stock - v_quantity) <= v_low_stock_threshold THEN
              INSERT INTO public.inventory_alerts (
                inventory_item_id,
                venue_id,
                alert_type,
                current_stock,
                threshold,
                message,
                created_at
              )
              VALUES (
                v_inventory_item_id,
                p_venue_id,
                'LOW_STOCK',
                v_current_stock - v_quantity,
                v_low_stock_threshold,
                'Low stock after order: ' || v_order_number,
                NOW()
              );
            END IF;
          ELSE
            -- Not enough stock - rollback
            RAISE EXCEPTION 'Insufficient stock for menu item %: required %, available %',
              v_menu_item_id, v_quantity, v_current_stock;
          END IF;
        END IF;
      END IF;
    END LOOP;
    
    -- Commit transaction
    RETURN QUERY SELECT v_order_id, v_order_number, true, NULL::TEXT;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction
      v_error_message := SQLERRM;
      RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false, v_error_message;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_order_atomic TO service_role;

-- Add comment
COMMENT ON FUNCTION public.create_order_atomic IS 'Atomically creates an order with items and inventory deduction in a single transaction';
```

**Verification**:
```sql
-- Check function exists
SELECT * FROM pg_proc WHERE proname = 'create_order_atomic';

-- Test function (replace with actual values)
-- SELECT * FROM public.create_order_atomic(
--   'your-venue-id'::UUID,
--   'your-table-id'::UUID,
--   1,
--   'Test Customer',
--   '1234567890',
--   'test@example.com',
--   '[{"menu_item_id": "your-menu-item-id", "quantity": 1, "price": 10.00}]'::JSONB,
--   10.00,
--   'STRIPE',
--   'ONLINE',
--   'QR',
--   'DINE_IN',
--   'DINE_IN',
--   false,
--   'Test order',
--   NULL,
--   true
-- );
```

---

## Migration 3: Atomic Payment Processing

**Purpose**: Process payments atomically with idempotency checks to prevent double-charging.

**Run in Supabase SQL Editor**:

```sql
-- Create atomic payment processing function
CREATE OR REPLACE FUNCTION public.process_payment_atomic(
  p_order_id UUID,
  p_venue_id UUID,
  p_payment_intent_id TEXT,
  p_payment_method TEXT,
  p_payment_status TEXT DEFAULT 'PAID',
  p_paid_by_user_id UUID DEFAULT NULL,
  p_refund_amount NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  payment_status TEXT,
  payment_method TEXT,
  success BOOLEAN,
  error_message TEXT,
  was_already_paid BOOLEAN
) AS $$
DECLARE
  v_order RECORD;
  v_payment_id UUID;
  v_was_already_paid BOOLEAN := false;
  v_error_message TEXT;
BEGIN
  -- Start transaction
  BEGIN
    -- Lock the order row to prevent concurrent updates
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;
    
    -- Check if order exists
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order not found: %', p_order_id;
    END IF;
    
    -- Check if order belongs to the venue
    IF v_order.venue_id != p_venue_id THEN
      RAISE EXCEPTION 'Order does not belong to venue: %', p_venue_id;
    END IF;
    
    -- Check if order is already paid
    IF v_order.payment_status = 'PAID' THEN
      v_was_already_paid := true;
      RETURN QUERY 
      SELECT 
        p_order_id,
        v_order.payment_status,
        v_order.payment_method,
        true,
        'Order already paid',
        true;
      RETURN;
    END IF;
    
    -- Validate payment method transition
    IF v_order.payment_status = 'REFUNDED' THEN
      RAISE EXCEPTION 'Cannot process payment for refunded order: %', p_order_id;
    END IF;
    
    -- Create payment transaction record
    INSERT INTO public.payment_transactions (
      order_id,
      venue_id,
      payment_intent_id,
      payment_method,
      payment_status,
      amount,
      paid_by_user_id,
      refund_amount,
      created_at
    )
    VALUES (
      p_order_id,
      p_venue_id,
      p_payment_intent_id,
      p_payment_method,
      p_payment_status,
      v_order.total_amount,
      p_paid_by_user_id,
      p_refund_amount,
      NOW()
    )
    RETURNING id INTO v_payment_id;
    
    -- Update order payment status
    UPDATE public.orders
    SET 
      payment_status = p_payment_status,
      payment_method = p_payment_method,
      payment_intent_id = p_payment_intent_id,
      paid_at = NOW(),
      updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Update order status if payment is successful
    IF p_payment_status = 'PAID' THEN
      UPDATE public.orders
      SET status = 'CONFIRMED'
      WHERE id = p_order_id;
    END IF;
    
    -- Commit transaction
    RETURN QUERY 
    SELECT 
      p_order_id,
      p_payment_status,
      p_payment_method,
      true,
      NULL::TEXT,
      false;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction
      v_error_message := SQLERRM;
      RETURN QUERY 
      SELECT 
        p_order_id,
        NULL::TEXT,
        NULL::TEXT,
        false,
        v_error_message,
        false;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.process_payment_atomic TO service_role;

-- Add comment
COMMENT ON FUNCTION public.process_payment_atomic IS 'Atomically processes payments with idempotency checks to prevent double-charging';
```

**Verification**:
```sql
-- Check function exists
SELECT * FROM pg_proc WHERE proname = 'process_payment_atomic';

-- Test function (replace with actual values)
-- SELECT * FROM public.process_payment_atomic(
--   'your-order-id'::UUID,
--   'your-venue-id'::UUID,
--   'pi_test123',
--   'STRIPE',
--   'PAID',
--   'user-id'::UUID,
--   NULL
-- );
```

---

## Migration 4: Atomic Inventory Deduction

**Purpose**: Deduct inventory atomically with stock validation and low stock alerting.

**Run in Supabase SQL Editor**:

```sql
-- Create atomic inventory deduction function
CREATE OR REPLACE FUNCTION public.deduct_inventory_atomic(
  p_venue_id UUID,
  p_order_id UUID,
  p_items JSONB
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT,
  items_processed INTEGER,
  items_failed INTEGER,
  low_stock_alerts INTEGER
) AS $$
DECLARE
  v_item JSONB;
  v_menu_item_id UUID;
  v_quantity INTEGER;
  v_inventory_item_id UUID;
  v_current_stock INTEGER;
  v_low_stock_threshold INTEGER;
  v_items_processed INTEGER := 0;
  v_items_failed INTEGER := 0;
  v_low_stock_alerts INTEGER := 0;
  v_error_message TEXT;
BEGIN
  -- Start transaction
  BEGIN
    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_menu_item_id := (v_item->>'menu_item_id')::UUID;
      v_quantity := (v_item->>'quantity')::INTEGER;
      
      -- Get inventory item for this menu item
      SELECT 
        ii.id,
        ii.current_stock,
        ii.low_stock_threshold
      INTO v_inventory_item_id, v_current_stock, v_low_stock_threshold
      FROM public.inventory_items ii
      JOIN public.menu_item_inventory mii ON ii.id = mii.inventory_item_id
      WHERE mii.menu_item_id = v_menu_item_id
        AND ii.venue_id = p_venue_id
      LIMIT 1;
      
      -- Check if inventory item exists
      IF v_inventory_item_id IS NULL THEN
        -- No inventory tracking for this item - skip
        v_items_processed := v_items_processed + 1;
        CONTINUE;
      END IF;
      
      -- Lock the inventory item row to prevent concurrent updates
      SELECT current_stock INTO v_current_stock
      FROM public.inventory_items
      WHERE id = v_inventory_item_id
      FOR UPDATE;
      
      -- Check if enough stock
      IF v_current_stock >= v_quantity THEN
        -- Deduct stock
        UPDATE public.inventory_items
        SET 
          current_stock = current_stock - v_quantity,
          updated_at = NOW()
        WHERE id = v_inventory_item_id;
        
        -- Create inventory transaction
        INSERT INTO public.inventory_transactions (
          inventory_item_id,
          venue_id,
          order_id,
          quantity,
          transaction_type,
          notes,
          created_at
        )
        VALUES (
          v_inventory_item_id,
          p_venue_id,
          p_order_id,
          -v_quantity,
          'SALE',
          'Order: ' || p_order_id,
          NOW()
        );
        
        -- Check for low stock alert
        IF (v_current_stock - v_quantity) <= v_low_stock_threshold THEN
          INSERT INTO public.inventory_alerts (
            inventory_item_id,
            venue_id,
            alert_type,
            current_stock,
            threshold,
            message,
            created_at
          )
          VALUES (
            v_inventory_item_id,
            p_venue_id,
            'LOW_STOCK',
            v_current_stock - v_quantity,
            v_low_stock_threshold,
            'Low stock after order: ' || p_order_id,
            NOW()
          );
          
          v_low_stock_alerts := v_low_stock_alerts + 1;
        END IF;
        
        v_items_processed := v_items_processed + 1;
      ELSE
        -- Not enough stock - rollback
        RAISE EXCEPTION 'Insufficient stock for menu item %: required %, available %',
          v_menu_item_id, v_quantity, v_current_stock;
      END IF;
    END LOOP;
    
    -- Commit transaction
    RETURN QUERY 
    SELECT 
      true,
      NULL::TEXT,
      v_items_processed,
      v_items_failed,
      v_low_stock_alerts;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction
      v_error_message := SQLERRM;
      RETURN QUERY 
      SELECT 
        false,
        v_error_message,
        v_items_processed,
        v_items_failed,
        v_low_stock_alerts;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.deduct_inventory_atomic TO service_role;

-- Add comment
COMMENT ON FUNCTION public.deduct_inventory_atomic IS 'Atomically deducts inventory with stock validation and low stock alerting';
```

**Verification**:
```sql
-- Check function exists
SELECT * FROM pg_proc WHERE proname = 'deduct_inventory_atomic';

-- Test function (replace with actual values)
-- SELECT * FROM public.deduct_inventory_atomic(
--   'your-venue-id'::UUID,
--   'your-order-id'::UUID,
--   '[{"menu_item_id": "your-menu-item-id", "quantity": 1}]'::JSONB
-- );
```

---

## Post-Migration Verification

After applying all migrations, run these verification queries:

```sql
-- 1. Check all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('idempotency_keys')
ORDER BY table_name;

-- 2. Check all functions were created
SELECT proname 
FROM pg_proc 
WHERE proname IN (
  'check_idempotency_key',
  'store_idempotency_response',
  'cleanup_expired_idempotency_keys',
  'create_order_atomic',
  'process_payment_atomic',
  'deduct_inventory_atomic'
)
ORDER BY proname;

-- 3. Check indexes
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename = 'idempotency_keys'
ORDER BY indexname;

-- 4. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename = 'idempotency_keys'
ORDER BY policyname;

-- 5. Check function permissions
SELECT 
  p.proname,
  pg_get_userbyid(p.proowner) AS owner,
  array_agg(a.grantee::regrole) AS grantees
FROM pg_proc p
LEFT JOIN pg_proc_acl a ON p.oid = a.prooid
WHERE p.proname IN (
  'check_idempotency_key',
  'store_idempotency_response',
  'cleanup_expired_idempotency_keys',
  'create_order_atomic',
  'process_payment_atomic',
  'deduct_inventory_atomic'
)
GROUP BY p.proname, p.proowner
ORDER BY p.proname;
```

---

## Rollback Instructions

If you need to rollback these migrations:

```sql
-- Drop functions
DROP FUNCTION IF EXISTS public.deduct_inventory_atomic CASCADE;
DROP FUNCTION IF EXISTS public.process_payment_atomic CASCADE;
DROP FUNCTION IF EXISTS public.create_order_atomic CASCADE;
DROP FUNCTION IF EXISTS public.store_idempotency_response CASCADE;
DROP FUNCTION IF EXISTS public.check_idempotency_key CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_idempotency_keys CASCADE;

-- Drop table
DROP TABLE IF EXISTS public.idempotency_keys CASCADE;
```

---

## Next Steps

After applying migrations:

1. **Test the atomic functions** with real data in a staging environment
2. **Update API routes** to use the new atomic RPC functions:
   - `/api/orders/create` → use `create_order_atomic`
   - `/api/orders/mark-paid` → use `process_payment_atomic`
   - `/api/orders/[orderId]/collect-payment` → use `process_payment_atomic`
3. **Replace `createAdminClient`** in AI tools with the RLS-respecting client factory
4. **Monitor** the new functions in production for performance and errors
5. **Set up alerts** for low stock and inventory issues

---

## Troubleshooting

### Migration fails with "permission denied"
- Ensure you're using the service role key
- Check that you have admin privileges on the database

### Function not found after migration
- Verify the function was created: `SELECT * FROM pg_proc WHERE proname = 'function_name'`
- Check for syntax errors in the migration

### RLS policy not working
- Verify RLS is enabled: `SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'idempotency_keys'`
- Check policy exists: `SELECT * FROM pg_policies WHERE tablename = 'idempotency_keys'`

### Performance issues
- Check indexes are created: `SELECT * FROM pg_indexes WHERE tablename = 'idempotency_keys'`
- Monitor query performance with `EXPLAIN ANALYZE`
