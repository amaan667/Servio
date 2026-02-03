-- Migration: Create atomic inventory deduction RPC function
-- This function ensures inventory deduction is atomic and prevents race conditions
-- Critical for preventing overselling and ensuring inventory consistency

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
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_menu_item_id UUID;
  v_quantity INTEGER;
  v_inventory_item_id UUID;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_items_processed INTEGER := 0;
  v_items_failed INTEGER := 0;
  v_low_stock_alerts INTEGER := 0;
  v_error_message TEXT;
BEGIN
  -- Validate required parameters
  IF p_venue_id IS NULL THEN
    RETURN QUERY SELECT false, 'venue_id is required'::TEXT, 0, 0, 0;
  END IF;

  IF p_order_id IS NULL THEN
    RETURN QUERY SELECT false, 'order_id is required'::TEXT, 0, 0, 0;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN QUERY SELECT false, 'items is required'::TEXT, 0, 0, 0;
  END IF;

  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Extract item data
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    -- Get current stock with lock
    SELECT id, stock
    INTO v_inventory_item_id, v_current_stock
    FROM public.inventory_items
    WHERE venue_id = p_venue_id
      AND menu_item_id = v_menu_item_id
    FOR UPDATE;

    -- Check if inventory item exists
    IF v_inventory_item_id IS NULL THEN
      -- Create inventory item if it doesn't exist
      INSERT INTO public.inventory_items (
        venue_id,
        menu_item_id,
        stock,
        low_stock_threshold,
        created_at,
        updated_at
      ) VALUES (
        p_venue_id,
        v_menu_item_id,
        0, -- Start with 0 stock
        5, -- Default low stock threshold
        NOW(),
        NOW()
      )
      RETURNING id INTO v_inventory_item_id;
      v_current_stock := 0;
    END IF;

    -- Check if enough stock
    IF v_current_stock < v_quantity THEN
      -- Not enough stock - create out of stock alert
      INSERT INTO public.inventory_alerts (
        venue_id,
        inventory_item_id,
        order_id,
        alert_type,
        current_stock,
        requested_quantity,
        message,
        created_at
      ) VALUES (
        p_venue_id,
        v_inventory_item_id,
        p_order_id,
        'out_of_stock',
        v_current_stock,
        v_quantity,
        'Insufficient stock: requested ' || v_quantity || ', available ' || v_current_stock,
        NOW()
      );

      v_items_failed := v_items_failed + 1;
      v_low_stock_alerts := v_low_stock_alerts + 1;
      CONTINUE;
    END IF;

    -- Deduct stock
    v_new_stock := v_current_stock - v_quantity;

    UPDATE public.inventory_items
    SET stock = v_new_stock,
        updated_at = NOW()
    WHERE id = v_inventory_item_id;

    -- Create inventory transaction
    INSERT INTO public.inventory_transactions (
      venue_id,
      inventory_item_id,
      order_id,
      quantity_change,
      previous_stock,
      new_stock,
      transaction_type,
      created_at
    ) VALUES (
      p_venue_id,
      v_inventory_item_id,
      p_order_id,
      -v_quantity,
      v_current_stock,
      v_new_stock,
      'order',
      NOW()
    );

    -- Check for low stock alert
    IF v_new_stock <= 5 THEN
      INSERT INTO public.inventory_alerts (
        venue_id,
        inventory_item_id,
        order_id,
        alert_type,
        current_stock,
        threshold,
        message,
        created_at
      ) VALUES (
        p_venue_id,
        v_inventory_item_id,
        p_order_id,
        'low_stock',
        v_new_stock,
        5,
        'Low stock alert: ' || v_new_stock || ' items remaining',
        NOW()
      );

      v_low_stock_alerts := v_low_stock_alerts + 1;
    END IF;

    v_items_processed := v_items_processed + 1;
  END LOOP;

  -- Return success
  RETURN QUERY SELECT true, NULL::TEXT, v_items_processed, v_items_failed, v_low_stock_alerts;

EXCEPTION
  WHEN OTHERS THEN
    v_error_message := SQLERRM;
    RETURN QUERY SELECT false, v_error_message, v_items_processed, v_items_failed, v_low_stock_alerts;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.deduct_inventory_atomic TO service_role;

-- Add comment to function
COMMENT ON FUNCTION public.deduct_inventory_atomic IS 'Atomic inventory deduction with stock validation. Prevents overselling and ensures inventory consistency.';

-- Create inventory_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  quantity_change INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  transaction_type TEXT NOT NULL, -- 'order', 'restock', 'adjustment', 'waste'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for inventory_transactions
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_venue_id ON public.inventory_transactions(venue_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_inventory_item_id ON public.inventory_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_order_id ON public.inventory_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON public.inventory_transactions(created_at);

-- Add comment to table
COMMENT ON TABLE public.inventory_transactions IS 'Inventory transaction history for audit trail and stock tracking';

-- Enable RLS on inventory_transactions
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read transactions for their venues
CREATE POLICY "Users can read inventory transactions for their venues"
ON public.inventory_transactions
FOR SELECT
TO authenticated
USING (
  venue_id IN (
    SELECT venue_id FROM venue_access
    WHERE user_id = auth.uid()
  )
);

-- RLS Policy: Service role can manage all inventory transactions
CREATE POLICY "Service role can manage all inventory transactions"
ON public.inventory_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
