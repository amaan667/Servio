-- Migration: Create atomic payment processing RPC function
-- This function ensures payment processing is atomic and prevents double-charging
-- Critical for preventing race conditions and ensuring payment consistency

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
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_order RECORD;
  v_current_payment_status TEXT;
  v_current_payment_method TEXT;
  v_error_message TEXT;
  v_was_already_paid BOOLEAN := false;
BEGIN
  -- Validate required parameters
  IF p_order_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, false, 'order_id is required'::TEXT, false;
  END IF;

  IF p_venue_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, false, 'venue_id is required'::TEXT, false;
  END IF;

  -- Lock the order row for update
  SELECT * INTO v_current_order
  FROM public.orders
  WHERE id = p_order_id
    AND venue_id = p_venue_id
  FOR UPDATE;

  -- Check if order exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, false, 'Order not found'::TEXT, false;
  END IF;

  -- Store current payment status
  v_current_payment_status := v_current_order.payment_status;
  v_current_payment_method := v_current_order.payment_method;

  -- Check if order is already paid
  IF v_current_payment_status = 'PAID' THEN
    v_was_already_paid := true;
    RETURN QUERY SELECT p_order_id, v_current_payment_status, v_current_payment_method, true, NULL::TEXT, true;
  END IF;

  -- Validate payment method transition
  -- Pay Now orders can only be paid via Stripe
  IF v_current_payment_method = 'PAY_NOW' AND p_payment_method != 'stripe' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, false, 'Pay Now orders can only be paid via Stripe'::TEXT, false;
  END IF;

  -- Pay at Till orders can only be paid via PAY_AT_TILL
  IF v_current_payment_method = 'PAY_AT_TILL' AND p_payment_method NOT IN ('PAY_AT_TILL', 'CASH', 'CARD') THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, false, 'Pay at Till orders can only be paid via Pay at Till, Cash, or Card'::TEXT, false;
  END IF;

  -- Pay Later orders can only be paid via PAY_LATER
  IF v_current_payment_method = 'PAY_LATER' AND p_payment_method != 'PAY_LATER' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, false, 'Pay Later orders can only be paid via Pay Later'::TEXT, false;
  END IF;

  -- Update order payment status
  UPDATE public.orders
  SET payment_status = p_payment_status,
      payment_method = p_payment_method,
      paid_at = NOW(),
      paid_by_user_id = p_paid_by_user_id,
      updated_at = NOW()
  WHERE id = p_order_id
    AND venue_id = p_venue_id;

  -- Handle refund amount if provided
  IF p_refund_amount IS NOT NULL AND p_refund_amount > 0 THEN
    UPDATE public.orders
    SET refund_amount = p_refund_amount,
        updated_at = NOW()
    WHERE id = p_order_id
      AND venue_id = p_venue_id;
  END IF;

  -- Create payment transaction record
  INSERT INTO public.payment_transactions (
    order_id,
    venue_id,
    payment_intent_id,
    payment_method,
    payment_status,
    amount,
    refund_amount,
    processed_by_user_id,
    created_at
  ) VALUES (
    p_order_id,
    p_venue_id,
    p_payment_intent_id,
    p_payment_method,
    p_payment_status,
    v_current_order.total_amount,
    p_refund_amount,
    p_paid_by_user_id,
    NOW()
  );

  -- Return success
  RETURN QUERY SELECT p_order_id, p_payment_status, p_payment_method, true, NULL::TEXT, v_was_already_paid;

EXCEPTION
  WHEN OTHERS THEN
    v_error_message := SQLERRM;
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, false, v_error_message, false;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.process_payment_atomic TO service_role;

-- Add comment to function
COMMENT ON FUNCTION public.process_payment_atomic IS 'Atomic payment processing with idempotency check. Prevents double-charging and ensures payment consistency.';

-- Create payment_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  payment_intent_id TEXT,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  refund_amount NUMERIC DEFAULT 0,
  processed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_venue_id ON public.payment_transactions(venue_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_intent_id ON public.payment_transactions(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON public.payment_transactions(created_at);

-- Add comment to table
COMMENT ON TABLE public.payment_transactions IS 'Payment transaction history for audit trail and idempotency';

-- Enable RLS on payment_transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read payment transactions for their venues
CREATE POLICY "Users can read payment transactions for their venues"
ON public.payment_transactions
FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM venue_access
    WHERE user_id = auth.uid()
  )
);

-- RLS Policy: Service role can manage all payment transactions
CREATE POLICY "Service role can manage all payment transactions"
ON public.payment_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
