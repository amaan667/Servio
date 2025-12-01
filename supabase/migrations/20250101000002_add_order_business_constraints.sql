-- Migration: Add business rule constraints to orders table
-- This enforces the POS flow requirements:
-- 1. Orders can only be COMPLETED when SERVED and PAID
-- 2. Payment mode and method must be consistent
-- 3. Pay Now requires customer_email

-- Note: Constraints are added with IF NOT EXISTS checks to be idempotent

-- 1. Completion requires served and paid
-- First, fix existing COMPLETED orders that don't meet the requirements
DO $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Fix COMPLETED orders that don't have paid status
  -- Set them to SERVED status so they can be properly completed later if needed
  UPDATE orders
  SET 
    order_status = 'SERVED',
    updated_at = NOW()
  WHERE 
    order_status = 'COMPLETED'
    AND (payment_status IS NULL OR UPPER(payment_status) NOT IN ('PAID', 'TILL'));
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows > 0 THEN
    RAISE NOTICE 'Fixed % COMPLETED orders without paid status (set to SERVED)', affected_rows;
  END IF;
  
  -- Fix COMPLETED orders that have TILL status - keep as TILL or normalize to PAID
  -- Note: TILL is a valid paid status in the database, so we keep it
  -- We'll accept both PAID and TILL as valid paid statuses in the constraint
END $$;

-- Now add the constraint (simplified: COMPLETED orders must have paid status)
-- Use UPPER() in constraint to handle case-insensitive comparison
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_completed_requires_served_and_paid'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_completed_requires_served_and_paid
    CHECK (
      -- If order is COMPLETED, payment must be paid
      -- Note: Served status is enforced at application level before allowing transition to COMPLETED
      -- The application ensures order_status is SERVED/READY/SERVING before allowing completion
      UPPER(order_status) != 'COMPLETED' 
      OR (payment_status IS NOT NULL AND UPPER(payment_status) IN ('PAID', 'TILL'))
    );
    
    COMMENT ON CONSTRAINT orders_completed_requires_served_and_paid ON orders IS 
    'Ensures COMPLETED orders must have paid status (PAID or TILL). Served status is enforced at application level - orders must be SERVED/READY/SERVING before completion.';
  END IF;
END $$;

-- 2. Payment mode ↔ method consistency
-- First, normalize existing data to match the constraint requirements
-- Goal: Every order must have a valid payment_method assigned
DO $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- STEP 1: Normalize old payment_method values to standard format
  -- Map old values like 'till', 'stripe', 'demo' to proper values
  UPDATE orders
  SET 
    payment_method = CASE
      WHEN UPPER(payment_method) IN ('TILL', 'PAY_AT_TILL') THEN 'PAY_AT_TILL'
      WHEN UPPER(payment_method) IN ('STRIPE', 'PAY_NOW', 'ONLINE') THEN 'PAY_NOW'
      WHEN UPPER(payment_method) IN ('PAY_LATER', 'LATER') THEN 'PAY_LATER'
      WHEN LOWER(payment_method) = 'demo' THEN 'PAY_NOW'  -- Demo orders -> PAY_NOW
      ELSE payment_method
    END,
    updated_at = NOW()
  WHERE 
    payment_method IS NOT NULL
    AND UPPER(payment_method) NOT IN ('PAY_NOW', 'PAY_LATER', 'PAY_AT_TILL');
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows > 0 THEN
    RAISE NOTICE 'Normalized % orders with old payment_method values', affected_rows;
  END IF;

  -- STEP 2: Normalize old payment_mode values to new standardized format
  -- Old format: 'pay_at_till' -> New format: 'offline'
  UPDATE orders
  SET 
    payment_mode = 'offline',
    payment_method = COALESCE(payment_method, 'PAY_AT_TILL'),
    updated_at = NOW()
  WHERE 
    LOWER(payment_mode) IN ('pay_at_till', 'till');
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows > 0 THEN
    RAISE NOTICE 'Normalized % orders from pay_at_till to offline mode', affected_rows;
  END IF;

  -- Old format: 'pay_later' -> New format: 'deferred'
  UPDATE orders
  SET 
    payment_mode = 'deferred',
    payment_method = COALESCE(payment_method, 'PAY_LATER'),
    updated_at = NOW()
  WHERE 
    LOWER(payment_mode) = 'pay_later';
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows > 0 THEN
    RAISE NOTICE 'Normalized % orders from pay_later to deferred mode', affected_rows;
  END IF;

  -- STEP 3: Infer payment_method from payment_mode for orders without payment_method
  -- Infer from payment_mode when payment_method is NULL
  UPDATE orders
  SET 
    payment_method = CASE
      WHEN LOWER(COALESCE(payment_mode, '')) IN ('offline', 'pay_at_till', 'till') THEN 'PAY_AT_TILL'
      WHEN LOWER(COALESCE(payment_mode, '')) IN ('deferred', 'pay_later') THEN 'PAY_LATER'
      WHEN LOWER(COALESCE(payment_mode, '')) IN ('online') OR payment_mode IS NULL THEN 'PAY_NOW'
      ELSE 'PAY_NOW'  -- Default fallback
    END,
    updated_at = NOW()
  WHERE 
    payment_method IS NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows > 0 THEN
    RAISE NOTICE 'Inferred payment_method for % orders from payment_mode', affected_rows;
  END IF;

  -- STEP 4: Normalize payment_mode to match payment_method
  -- Ensure payment_mode is set correctly based on payment_method
  UPDATE orders
  SET 
    payment_mode = CASE 
      WHEN UPPER(payment_method) = 'PAY_NOW' THEN 'online'
      WHEN UPPER(payment_method) = 'PAY_AT_TILL' THEN 'offline'
      WHEN UPPER(payment_method) = 'PAY_LATER' THEN 
        CASE 
          WHEN LOWER(COALESCE(payment_mode, '')) = 'online' THEN 'online'
          ELSE 'deferred'
        END
      ELSE payment_mode
    END,
    updated_at = NOW()
  WHERE 
    payment_method IS NOT NULL;
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows > 0 THEN
    RAISE NOTICE 'Normalized payment_mode for % orders to match payment_method', affected_rows;
  END IF;

  -- STEP 5: Fix any remaining mismatched combinations
  -- If payment_method and payment_mode don't match, fix payment_mode to match payment_method
  UPDATE orders
  SET 
    payment_mode = CASE 
      WHEN UPPER(payment_method) = 'PAY_NOW' THEN 'online'
      WHEN UPPER(payment_method) = 'PAY_AT_TILL' THEN 'offline'
      WHEN UPPER(payment_method) = 'PAY_LATER' THEN 'deferred'
      ELSE payment_mode
    END,
    updated_at = NOW()
  WHERE 
    payment_method IS NOT NULL
    AND NOT (
      (UPPER(payment_method) = 'PAY_NOW' AND LOWER(COALESCE(payment_mode, '')) = 'online')
      OR (UPPER(payment_method) = 'PAY_AT_TILL' AND LOWER(COALESCE(payment_mode, '')) = 'offline')
      OR (UPPER(payment_method) = 'PAY_LATER' AND LOWER(COALESCE(payment_mode, '')) IN ('deferred', 'online'))
    );
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows > 0 THEN
    RAISE NOTICE 'Fixed % orders with mismatched payment_method and payment_mode', affected_rows;
  END IF;

  -- STEP 6: Final fallback - assign default payment_method to any remaining orders
  -- This should be rare, but ensures every order has a payment_method
  UPDATE orders
  SET 
    payment_method = 'PAY_AT_TILL',
    payment_mode = 'offline',
    updated_at = NOW()
  WHERE 
    payment_method IS NULL
    OR UPPER(payment_method) NOT IN ('PAY_NOW', 'PAY_LATER', 'PAY_AT_TILL');
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows > 0 THEN
    RAISE NOTICE 'Assigned default payment_method (PAY_AT_TILL) to % orders', affected_rows;
  END IF;

END $$;

-- Now add the constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_payment_mode_method_consistency'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_payment_mode_method_consistency
    CHECK (
      payment_method IS NOT NULL
      AND (
        (UPPER(payment_method) = 'PAY_NOW' AND LOWER(COALESCE(payment_mode, '')) = 'online')
        OR (UPPER(payment_method) = 'PAY_LATER' AND LOWER(COALESCE(payment_mode, '')) IN ('online', 'deferred'))
        OR (UPPER(payment_method) = 'PAY_AT_TILL' AND LOWER(COALESCE(payment_mode, '')) = 'offline')
      )
    );
    
    COMMENT ON CONSTRAINT orders_payment_mode_method_consistency ON orders IS 
    'Ensures payment_mode and payment_method are consistent and payment_method is always set: PAY_NOW→online, PAY_LATER→online/deferred, PAY_AT_TILL→offline';
  END IF;
END $$;

-- 3. Pay Now requires email
-- First, fix existing PAY_NOW orders that don't have email (change to PAY_AT_TILL instead)
DO $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- For existing PAY_NOW orders without email, change them to PAY_AT_TILL
  -- This preserves the order data while ensuring they have a valid payment method
  UPDATE orders
  SET 
    payment_method = 'PAY_AT_TILL',
    payment_mode = 'offline',
    updated_at = NOW()
  WHERE 
    UPPER(payment_method) = 'PAY_NOW'
    AND (customer_email IS NULL OR customer_email = '');
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows > 0 THEN
    RAISE NOTICE 'Changed % PAY_NOW orders without email to PAY_AT_TILL', affected_rows;
  END IF;
END $$;

-- Now add the constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_pay_now_requires_email'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_pay_now_requires_email
    CHECK (
      UPPER(COALESCE(payment_method, '')) != 'PAY_NOW'
      OR customer_email IS NOT NULL
    );
    
    COMMENT ON CONSTRAINT orders_pay_now_requires_email ON orders IS 
    'Ensures PAY_NOW orders have customer_email for Stripe receipt delivery';
  END IF;
END $$;

-- Add helpful comments to key columns if they don't exist
DO $$
BEGIN
  -- Comment on payment_status enum values
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_description 
    WHERE objoid = (SELECT oid FROM pg_class WHERE relname = 'orders')
    AND objsubid = (SELECT attnum FROM pg_attribute WHERE attrelid = (SELECT oid FROM pg_class WHERE relname = 'orders') AND attname = 'payment_status')
  ) THEN
    COMMENT ON COLUMN orders.payment_status IS 
    'Payment status: UNPAID, PAYMENT_PENDING, PAID, TILL (paid at till), FAILED, REFUNDED';
  END IF;

  -- Comment on payment_method enum values
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_description 
    WHERE objoid = (SELECT oid FROM pg_class WHERE relname = 'orders')
    AND objsubid = (SELECT attnum FROM pg_attribute WHERE attrelid = (SELECT oid FROM pg_class WHERE relname = 'orders') AND attname = 'payment_method')
  ) THEN
    COMMENT ON COLUMN orders.payment_method IS 
    'Payment method: PAY_NOW (Stripe Checkout), PAY_LATER (deferred Stripe), PAY_AT_TILL (offline staff confirmation)';
  END IF;

  -- Comment on payment_mode enum values
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_description 
    WHERE objoid = (SELECT oid FROM pg_class WHERE relname = 'orders')
    AND objsubid = (SELECT attnum FROM pg_attribute WHERE attrelid = (SELECT oid FROM pg_class WHERE relname = 'orders') AND attname = 'payment_mode')
  ) THEN
    COMMENT ON COLUMN orders.payment_mode IS 
    'Payment mode: online (Stripe), offline (till), deferred (Pay Later)';
  END IF;
END $$;

