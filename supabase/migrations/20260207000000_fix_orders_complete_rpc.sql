-- Migration: Fix orders_complete RPC function
-- Issues: 1) "function name is not unique" when dropping (multiple overloads)
--         2) "column reference forced_completed_at is ambiguous" in UPDATE

-- Drop ALL overloads of orders_complete (avoids "function name is not unique")
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'orders_complete'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.orders_complete(%s)', r.args);
  END LOOP;
END
$$;

-- Create single RPC with unambiguous column references (alias ord in UPDATE, explicit columns in RETURN)
CREATE OR REPLACE FUNCTION public.orders_complete(
  p_order_id UUID,
  p_venue_id UUID,
  p_forced BOOLEAN DEFAULT false,
  p_forced_by UUID DEFAULT NULL,
  p_forced_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  venue_id UUID,
  table_number INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  items JSONB,
  total_amount NUMERIC,
  order_status TEXT,
  payment_status TEXT,
  payment_method TEXT,
  payment_mode TEXT,
  notes TEXT,
  source TEXT,
  qr_type TEXT,
  requires_collection BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  table_id UUID,
  fulfillment_type TEXT,
  counter_label TEXT,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  payment_completed_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  kitchen_status TEXT,
  completed_at TIMESTAMPTZ,
  forced_completed_at TIMESTAMPTZ,
  forced_completed_by UUID,
  forced_reason TEXT,
  order_number TEXT,
  session_id TEXT,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_order RECORD;
BEGIN
  SELECT * INTO v_current_order
  FROM public.orders
  WHERE id = p_order_id
    AND venue_id = p_venue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF p_forced AND p_forced_by IS NULL THEN
    RAISE EXCEPTION 'Forced completion requires user ID';
  END IF;

  IF NOT p_forced THEN
    IF v_current_order.order_status != 'SERVED' THEN
      RAISE EXCEPTION 'Order must be served before completion';
    END IF;
    IF v_current_order.payment_status NOT IN ('PAID', 'PAY_LATER', 'PAY_AT_TILL') THEN
      RAISE EXCEPTION 'Order must be paid before completion';
    END IF;
  END IF;

  -- Use alias ord so forced_completed_at etc. are unambiguous.
  -- When forced, set served_at if NULL so any DB constraint on completed orders is satisfied.
  UPDATE public.orders AS ord
  SET
    order_status = 'COMPLETED',
    completed_at = NOW(),
    served_at = CASE WHEN p_forced AND ord.served_at IS NULL THEN NOW() ELSE ord.served_at END,
    forced_completed_at = CASE WHEN p_forced THEN NOW() ELSE ord.forced_completed_at END,
    forced_completed_by = CASE WHEN p_forced THEN p_forced_by ELSE ord.forced_completed_by END,
    forced_reason = CASE WHEN p_forced THEN p_forced_reason ELSE ord.forced_reason END,
    updated_at = NOW()
  WHERE ord.id = p_order_id
    AND ord.venue_id = p_venue_id;

  -- Explicit column list avoids ambiguity with RETURNS TABLE
  RETURN QUERY
  SELECT
    o.id, o.venue_id, o.table_number, o.customer_name, o.customer_phone, o.customer_email,
    o.items, o.total_amount, o.order_status, o.payment_status, o.payment_method, o.payment_mode,
    o.notes, o.source, o.qr_type, o.requires_collection, o.created_at, o.updated_at,
    o.table_id, o.fulfillment_type, o.counter_label, o.stripe_session_id, o.stripe_payment_intent_id,
    o.payment_completed_at, o.served_at, o.kitchen_status, o.completed_at,
    o.forced_completed_at, o.forced_completed_by, o.forced_reason,
    o.order_number, o.session_id, o.is_active
  FROM public.orders o
  WHERE o.id = p_order_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.orders_complete(UUID, UUID, BOOLEAN, UUID, TEXT) TO service_role, authenticated;
COMMENT ON FUNCTION public.orders_complete(UUID, UUID, BOOLEAN, UUID, TEXT) IS 'Marks an order as completed with proper validation. Handles both normal and forced completion.';
