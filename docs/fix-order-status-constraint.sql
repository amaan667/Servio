-- Fix for order_status constraint to include SERVED status
-- Run this in your Supabase SQL editor to fix the constraint violation

-- First, drop the existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;

-- Add new constraint that includes SERVED
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
  CHECK (order_status IN (
    'PLACED',
    'ACCEPTED', 
    'IN_PREP',
    'READY',
    'SERVING',
    'SERVED',
    'OUT_FOR_DELIVERY',
    'COMPLETED',
    'CANCELLED',
    'REFUNDED',
    'EXPIRED'
  ));

