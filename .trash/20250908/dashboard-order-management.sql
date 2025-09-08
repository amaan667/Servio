-- Dashboard Order Management Migration
-- This migration creates the required view, functions, and triggers for the new order management system

-- 1. Create/refresh the totals view with non-colliding names
CREATE OR REPLACE VIEW public.orders_with_totals AS
WITH item_totals AS (
  SELECT
    o.id as order_id,
    COALESCE(SUM(
      (CASE
         WHEN item->>'price' IS NOT NULL THEN (item->>'price')::numeric
         WHEN item->>'unit_price' IS NOT NULL THEN (item->>'unit_price')::numeric
         ELSE 0
       END) * COALESCE((item->>'quantity')::integer, 1)
    ), 0)::numeric AS calc_subtotal_amount,
    0::numeric AS calc_tax_amount,
    0::numeric AS calc_service_amount
  FROM public.orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
  GROUP BY o.id
)
SELECT
  o.*,
  COALESCE(it.calc_subtotal_amount, 0)::numeric AS calc_subtotal_amount,
  0::numeric AS calc_tax_amount,
  0::numeric AS calc_service_amount,
  (COALESCE(it.calc_subtotal_amount, 0))::numeric AS calc_total_amount
FROM public.orders o
LEFT JOIN item_totals it ON it.order_id = o.id;

-- 2. Update order status constraints to match the new flow
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check 
  CHECK (order_status IN ('PLACED', 'IN_PREP', 'READY', 'SERVING', 'SERVED', 'CANCELLED', 'REFUNDED', 'EXPIRED'));

-- 3. Update payment status constraints
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('UNPAID', 'PAID', 'REFUNDED'));

-- 4. Create the transition validation function
CREATE OR REPLACE FUNCTION public.can_transition(old_status text, new_status text, paid text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF old_status = new_status THEN RETURN true; END IF;

  -- Require PAID before moving beyond PLACED
  IF paid <> 'PAID' AND new_status IN ('IN_PREP','READY','SERVING','SERVED') THEN
    RETURN false;
  END IF;

  CASE old_status
    WHEN 'PLACED'  THEN RETURN new_status IN ('IN_PREP','CANCELLED');
    WHEN 'IN_PREP' THEN RETURN new_status IN ('READY','CANCELLED');
    WHEN 'READY'   THEN RETURN new_status IN ('SERVING','CANCELLED');
    WHEN 'SERVING' THEN RETURN new_status IN ('SERVED','CANCELLED');
    ELSE
      -- terminal states cannot change
      RETURN false;
  END CASE;
END;
$$;

-- 5. Create the transition guard trigger function
CREATE OR REPLACE FUNCTION public.orders_transition_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.order_status IS DISTINCT FROM OLD.order_status THEN
    IF NOT public.can_transition(OLD.order_status, NEW.order_status, NEW.payment_status) THEN
      RAISE EXCEPTION 'Illegal order status transition: % -> % (payment=%)', OLD.order_status, NEW.order_status, NEW.payment_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Create the transition guard trigger
DROP TRIGGER IF EXISTS trg_orders_transition_guard ON public.orders;
CREATE TRIGGER trg_orders_transition_guard
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.orders_transition_guard();

-- 7. Update existing orders to use new status values
UPDATE public.orders SET order_status = 'SERVED' WHERE order_status = 'COMPLETED';
UPDATE public.orders SET order_status = 'PLACED' WHERE order_status = 'ACCEPTED';
UPDATE public.orders SET order_status = 'SERVING' WHERE order_status = 'OUT_FOR_DELIVERY';

-- 8. Update payment status to match new constraints
UPDATE public.orders SET payment_status = 'UNPAID' WHERE payment_status = 'IN_PROGRESS';

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_status_payment ON public.orders(order_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_updated ON public.orders(created_at, updated_at);

-- 10. Grant permissions
GRANT SELECT ON public.orders_with_totals TO authenticated;
GRANT UPDATE ON public.orders TO authenticated;
