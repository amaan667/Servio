-- Check current order status for the Earlier Today order
SELECT 
    'Current order status:' as info,
    id,
    order_status,
    payment_status,
    table_number,
    customer_name,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d' 
    AND table_number = 1 
    AND customer_name = 'Amaan Tanveer'
ORDER BY created_at DESC 
LIMIT 1;

-- Update the order to a proper workflow status (IN_PREP) so action buttons appear
UPDATE orders 
SET 
    order_status = 'IN_PREP',
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d' 
    AND table_number = 1 
    AND customer_name = 'Amaan Tanveer'
    AND order_status = 'COMPLETED';

-- Verify the update
SELECT 
    'Updated order status:' as info,
    id,
    order_status,
    payment_status,
    table_number,
    customer_name,
    updated_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d' 
    AND table_number = 1 
    AND customer_name = 'Amaan Tanveer'
ORDER BY created_at DESC 
LIMIT 1;
