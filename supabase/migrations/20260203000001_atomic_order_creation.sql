-- Migration: Create atomic order creation RPC function
-- This function ensures order creation is atomic and includes all necessary operations
-- Critical for preventing race conditions and ensuring data consistency

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
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_item JSONB;
  v_menu_item_id UUID;
  v_quantity INTEGER;
  v_inventory_item_id UUID;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_error_message TEXT;
BEGIN
  -- Validate required parameters
  IF p_venue_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false, 'venue_id is required'::TEXT;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false, 'items is required'::TEXT;
  END IF;

  -- Generate order number if not provided
  IF p_order_number IS NULL OR p_order_number = '' THEN
    SELECT 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0')
    INTO v_order_number;
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
    items,
    total_amount,
    order_status,
    payment_status,
    payment_method,
    payment_mode,
    source,
    qr_type,
    fulfillment_type,
    requires_collection,
    notes,
    order_number,
    created_at,
    updated_at
  ) VALUES (
    p_venue_id,
    p_table_id,
    p_table_number,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_items,
    p_total_amount,
    'PLACED',
    'UNPAID',
    p_payment_method,
    p_payment_mode,
    p_source,
    p_qr_type,
    p_fulfillment_type,
    p_requires_collection,
    p_notes,
    v_order_number,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- Create order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Extract item data
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    -- Insert order item
    INSERT INTO public.order_items (
      order_id,
      menu_item_id,
      quantity,
      special_instructions,
      unit_price,
      total_price,
      created_at,
      updated_at
    ) VALUES (
      v_order_id,
      v_menu_item_id,
      v_quantity,
      v_item->>'special_instructions',
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'total_price')::NUMERIC,
      NOW(),
      NOW()
    );

    -- Deduct inventory if requested
    IF p_deduct_inventory THEN
      -- Get current stock
      SELECT id, stock
      INTO v_inventory_item_id, v_current_stock
      FROM public.inventory_items
      WHERE venue_id = p_venue_id
        AND menu_item_id = v_menu_item_id
      FOR UPDATE;

      -- Deduct stock
      IF v_inventory_item_id IS NOT NULL THEN
        v_new_stock := v_current_stock - v_quantity;

        -- Update inventory
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
          v_order_id,
          -v_quantity,
          v_current_stock,
          v_new_stock,
          'order',
          NOW()
        );

        -- Check for low stock alert
        IF v_new_stock <= 5 THEN
          -- Create inventory alert
          INSERT INTO public.inventory_alerts (
            venue_id,
            inventory_item_id,
            alert_type,
            current_stock,
            threshold,
            message,
            created_at
          ) VALUES (
            p_venue_id,
            v_inventory_item_id,
            'low_stock',
            v_new_stock,
            5,
            'Low stock alert: ' || v_new_stock || ' items remaining',
            NOW()
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Return success
  RETURN QUERY SELECT v_order_id, v_order_number, true, NULL::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    v_error_message := SQLERRM;
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, false, v_error_message;
END;
$$;

-- Create sequence for order numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.create_order_atomic TO service_role;

-- Add comment to function
COMMENT ON FUNCTION public.create_order_atomic IS 'Atomic order creation with inventory deduction. Creates order, order items, and updates inventory in a single transaction.';

-- Grant usage on sequence
GRANT USAGE ON SEQUENCE public.order_number_seq TO service_role;
