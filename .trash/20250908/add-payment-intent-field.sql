-- Add payment_intent_id field to orders table for unified checkout flow
-- This allows us to track which Stripe payment intent created each order

-- Add payment_intent_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'payment_intent_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN payment_intent_id TEXT;
    END IF;
END $$;

-- Add index for efficient lookups by payment intent ID
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id ON orders(payment_intent_id);

-- Add comment to document the field
COMMENT ON COLUMN orders.payment_intent_id IS 'Stripe payment intent ID - used for idempotent order creation and payment tracking';

-- Update existing orders to have NULL payment_intent_id (they were created before this field)
-- This is safe since existing orders don't have payment intent IDs
UPDATE orders SET payment_intent_id = NULL WHERE payment_intent_id IS NULL;
