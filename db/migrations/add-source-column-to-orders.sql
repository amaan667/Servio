-- Add source column to orders table to track whether order came from QR code or counter
-- This will allow us to display "Counter X" vs "Table X" correctly in the dashboard

-- Add the source column with default value 'qr' for existing orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter'));

-- Update existing orders to have the correct source based on table_number
-- For now, we'll assume all existing orders are from QR codes (tables)
-- If you have specific orders that should be marked as counter orders, update them manually

-- Example: If you know order ID 'some-order-id' was placed at counter, run:
-- UPDATE orders SET source = 'counter' WHERE id = 'some-order-id';

-- Verify the column was added
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'source';
