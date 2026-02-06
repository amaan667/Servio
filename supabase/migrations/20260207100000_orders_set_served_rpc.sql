-- Migration: Create orders_set_served RPC so mark-served flow never fails with "function does not exist"
-- Updates order to SERVED + served_at and table_sessions to SERVED; returns the updated order.

DROP FUNCTION IF EXISTS public.orders_set_served(UUID, UUID);

CREATE OR REPLACE FUNCTION public.orders_set_served(p_order_id UUID, p_venue_id UUID)
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
BEGIN
  -- Update order to SERVED (no kitchen_status requirement so all payment methods work)
  UPDATE public.orders AS o
  SET
    order_status = 'SERVED',
    served_at = COALESCE(o.served_at, NOW()),
    updated_at = NOW()
  WHERE o.id = p_order_id
    AND o.venue_id = p_venue_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Best-effort: update table_sessions for this order
  UPDATE public.table_sessions
  SET status = 'SERVED', updated_at = NOW()
  WHERE order_id = p_order_id
    AND venue_id = p_venue_id;

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
END;
$$;

GRANT EXECUTE ON FUNCTION public.orders_set_served(UUID, UUID) TO service_role, authenticated;
COMMENT ON FUNCTION public.orders_set_served(UUID, UUID) IS 'Marks an order as served. Sets order_status=SERVED, served_at; updates table_sessions.';
