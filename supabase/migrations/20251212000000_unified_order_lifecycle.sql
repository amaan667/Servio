-- Migration: Unified order lifecycle state model
-- Adds canonical lifecycle fields + auditable forced completion + payments ledger for partial payments.

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================================
-- 1) Orders: canonical lifecycle fields
-- ========================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS kitchen_status TEXT NOT NULL DEFAULT 'PREPARING',
  ADD COLUMN IF NOT EXISTS service_status TEXT NOT NULL DEFAULT 'NOT_SERVED',
  ADD COLUMN IF NOT EXISTS completion_status TEXT NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS forced_completed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS forced_completed_by UUID NULL,
  ADD COLUMN IF NOT EXISTS forced_completed_reason TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_kitchen_status_valid'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_kitchen_status_valid
      CHECK (UPPER(kitchen_status) IN ('PREPARING','READY','BUMPED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_service_status_valid'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_service_status_valid
      CHECK (UPPER(service_status) IN ('NOT_SERVED','SERVED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_completion_status_valid'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_completion_status_valid
      CHECK (UPPER(completion_status) IN ('OPEN','COMPLETED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_forced_completion_requires_metadata'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_forced_completion_requires_metadata
      CHECK (
        forced_completed_at IS NULL
        OR (forced_completed_by IS NOT NULL AND forced_completed_reason IS NOT NULL)
      );
  END IF;
END $$;

-- Backfill existing orders into the canonical model.
-- Safest defaults: OPEN / NOT_SERVED / PREPARING / UNPAID.
DO $$
BEGIN
  -- completion_status
  UPDATE orders
  SET completion_status = CASE
    WHEN UPPER(COALESCE(order_status, '')) IN ('COMPLETED','CANCELLED','REFUNDED','EXPIRED') THEN 'COMPLETED'
    ELSE 'OPEN'
  END
  WHERE completion_status IS NULL
     OR UPPER(completion_status) NOT IN ('OPEN','COMPLETED');

  -- service_status
  UPDATE orders
  SET service_status = CASE
    WHEN UPPER(COALESCE(order_status, '')) IN ('SERVED','SERVING','COMPLETED') THEN 'SERVED'
    ELSE 'NOT_SERVED'
  END
  WHERE service_status IS NULL
     OR UPPER(service_status) NOT IN ('NOT_SERVED','SERVED');

  -- kitchen_status
  UPDATE orders
  SET kitchen_status = CASE
    WHEN UPPER(COALESCE(order_status, '')) IN ('READY') THEN 'READY'
    WHEN UPPER(COALESCE(order_status, '')) IN ('SERVING','SERVED','COMPLETED') THEN 'BUMPED'
    ELSE 'PREPARING'
  END
  WHERE kitchen_status IS NULL
     OR UPPER(kitchen_status) NOT IN ('PREPARING','READY','BUMPED');

  -- Normalize payment_status into canonical set (keep REFUNDED if already used)
  UPDATE orders
  SET payment_status = CASE
    WHEN UPPER(COALESCE(payment_status, '')) IN ('PAID','TILL') THEN 'PAID'
    WHEN UPPER(COALESCE(payment_status, '')) IN ('PARTIALLY_PAID') THEN 'PARTIALLY_PAID'
    WHEN UPPER(COALESCE(payment_status, '')) IN ('REFUNDED') THEN 'REFUNDED'
    ELSE 'UNPAID'
  END
  WHERE payment_status IS NULL
     OR UPPER(payment_status) IN ('TILL');

  -- Ensure newly completed orders have a completed_at timestamp (best-effort)
  UPDATE orders
  SET completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
  WHERE UPPER(completion_status) = 'COMPLETED'
    AND completed_at IS NULL;
END $$;

-- Helpful index for open-order queries.
CREATE INDEX IF NOT EXISTS idx_orders_open_lifecycle
  ON orders (venue_id, completion_status, kitchen_status, service_status, payment_status, created_at DESC);

-- ========================================
-- 2) Payments ledger: order_payments
-- ========================================

CREATE TABLE IF NOT EXISTS order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  order_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order
  ON order_payments (venue_id, order_id, created_at DESC);

-- ========================================
-- 3) RPC helpers (atomic eligibility checks)
-- ========================================

CREATE OR REPLACE FUNCTION public.orders_set_kitchen_bumped(
  p_order_id UUID,
  p_venue_id TEXT
)
RETURNS TABLE (
  id UUID,
  venue_id TEXT,
  kitchen_status TEXT,
  service_status TEXT,
  completion_status TEXT,
  payment_status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE orders
  SET
    kitchen_status = 'BUMPED',
    -- Keep legacy order_status aligned for backward compatibility
    order_status = CASE
      WHEN UPPER(COALESCE(order_status, '')) IN ('COMPLETED','CANCELLED','REFUNDED') THEN order_status
      ELSE 'READY'
    END,
    updated_at = NOW()
  WHERE orders.id = p_order_id
    AND orders.venue_id = p_venue_id
    AND UPPER(orders.completion_status) = 'OPEN'
    AND UPPER(orders.kitchen_status) <> 'BUMPED'
  RETURNING orders.id, orders.venue_id, orders.kitchen_status, orders.service_status, orders.completion_status, orders.payment_status
  INTO id, venue_id, kitchen_status, service_status, completion_status, payment_status;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT o.id, o.venue_id, o.kitchen_status, o.service_status, o.completion_status, o.payment_status
    FROM orders o
    WHERE o.id = p_order_id AND o.venue_id = p_venue_id;
    RETURN;
  END IF;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_set_served(
  p_order_id UUID,
  p_venue_id TEXT
)
RETURNS TABLE (
  id UUID,
  venue_id TEXT,
  kitchen_status TEXT,
  service_status TEXT,
  completion_status TEXT,
  payment_status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Enforce: you can only serve after bump.
  IF EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id
      AND o.venue_id = p_venue_id
      AND UPPER(o.completion_status) = 'OPEN'
      AND UPPER(o.kitchen_status) <> 'BUMPED'
  ) THEN
    RAISE EXCEPTION 'Order must be bumped before it can be served';
  END IF;

  UPDATE orders
  SET
    service_status = 'SERVED',
    order_status = CASE
      WHEN UPPER(COALESCE(order_status, '')) = 'COMPLETED' THEN order_status
      ELSE 'SERVED'
    END,
    served_at = COALESCE(served_at, NOW()),
    updated_at = NOW()
  WHERE id = p_order_id
    AND venue_id = p_venue_id
    AND UPPER(completion_status) = 'OPEN'
    AND UPPER(service_status) <> 'SERVED'
  RETURNING orders.id, orders.venue_id, orders.kitchen_status, orders.service_status, orders.completion_status, orders.payment_status
  INTO id, venue_id, kitchen_status, service_status, completion_status, payment_status;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT o.id, o.venue_id, o.kitchen_status, o.service_status, o.completion_status, o.payment_status
    FROM orders o
    WHERE o.id = p_order_id AND o.venue_id = p_venue_id;
    RETURN;
  END IF;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_complete(
  p_order_id UUID,
  p_venue_id TEXT,
  p_forced BOOLEAN DEFAULT FALSE,
  p_forced_by UUID DEFAULT NULL,
  p_forced_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  venue_id TEXT,
  completion_status TEXT,
  payment_status TEXT,
  forced_completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id AND venue_id = p_venue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Idempotent: already completed
  IF UPPER(COALESCE(v_order.completion_status, '')) = 'COMPLETED'
     OR UPPER(COALESCE(v_order.order_status, '')) = 'COMPLETED' THEN
    RETURN QUERY
    SELECT v_order.id, v_order.venue_id, COALESCE(v_order.completion_status, 'COMPLETED'), v_order.payment_status, v_order.forced_completed_at;
    RETURN;
  END IF;

  IF NOT p_forced THEN
    -- Normal eligibility
    IF NOT (UPPER(COALESCE(v_order.service_status, '')) = 'SERVED' AND UPPER(COALESCE(v_order.payment_status, '')) = 'PAID') THEN
      RAISE EXCEPTION 'Order not eligible for completion (must be SERVED and PAID)';
    END IF;
  ELSE
    IF p_forced_by IS NULL OR p_forced_reason IS NULL OR LENGTH(TRIM(p_forced_reason)) = 0 THEN
      RAISE EXCEPTION 'Forced completion requires forced_by and forced_reason';
    END IF;
  END IF;

  UPDATE orders
  SET
    completion_status = 'COMPLETED',
    order_status = 'COMPLETED',
    completed_at = COALESCE(completed_at, NOW()),
    forced_completed_at = CASE WHEN p_forced THEN NOW() ELSE forced_completed_at END,
    forced_completed_by = CASE WHEN p_forced THEN p_forced_by ELSE forced_completed_by END,
    forced_completed_reason = CASE WHEN p_forced THEN p_forced_reason ELSE forced_completed_reason END,
    updated_at = NOW()
  WHERE id = p_order_id AND venue_id = p_venue_id
  RETURNING orders.id, orders.venue_id, orders.completion_status, orders.payment_status, orders.forced_completed_at
  INTO id, venue_id, completion_status, payment_status, forced_completed_at;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.orders_force_complete_all(
  p_venue_id TEXT,
  p_forced_by UUID,
  p_forced_reason TEXT,
  p_order_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  IF p_forced_by IS NULL OR p_forced_reason IS NULL OR LENGTH(TRIM(p_forced_reason)) = 0 THEN
    RAISE EXCEPTION 'Forced completion requires forced_by and forced_reason';
  END IF;

  UPDATE orders
  SET
    completion_status = 'COMPLETED',
    order_status = 'COMPLETED',
    completed_at = COALESCE(completed_at, NOW()),
    forced_completed_at = NOW(),
    forced_completed_by = p_forced_by,
    forced_completed_reason = p_forced_reason,
    updated_at = NOW()
  WHERE venue_id = p_venue_id
    AND UPPER(completion_status) = 'OPEN'
    AND (
      p_order_ids IS NULL
      OR id = ANY(p_order_ids)
    );

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_order_payment(
  p_order_id UUID,
  p_venue_id TEXT,
  p_amount NUMERIC,
  p_method TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  venue_id TEXT,
  payment_status TEXT,
  paid_total NUMERIC,
  order_total NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total NUMERIC;
  v_paid NUMERIC;
BEGIN
  SELECT total_amount INTO v_total
  FROM orders
  WHERE id = p_order_id AND venue_id = p_venue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  INSERT INTO order_payments (venue_id, order_id, amount, method, created_by)
  VALUES (p_venue_id, p_order_id, p_amount, p_method, p_created_by);

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM order_payments
  WHERE venue_id = p_venue_id AND order_id = p_order_id;

  UPDATE orders
  SET
    payment_status = CASE
      WHEN v_paid <= 0 THEN 'UNPAID'
      WHEN v_paid + 0.00001 >= v_total THEN 'PAID'
      ELSE 'PARTIALLY_PAID'
    END,
    updated_at = NOW()
  WHERE id = p_order_id AND venue_id = p_venue_id;

  RETURN QUERY
  SELECT o.id, o.venue_id, o.payment_status, v_paid AS paid_total, v_total AS order_total
  FROM orders o
  WHERE o.id = p_order_id AND o.venue_id = p_venue_id;
END;
$$;
