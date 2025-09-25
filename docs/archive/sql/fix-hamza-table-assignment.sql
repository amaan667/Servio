-- Fix Hamza's order table assignment
-- Based on screenshot: Hamza £133.50 should be on Table 9, not Table 1

-- First, let's find the Hamza order
SELECT 
    'Finding Hamza order:' as info,
    id,
    table_number,
    customer_name,
    total_amount,
    source,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND total_amount = 13350  -- £133.50 in pence
  AND customer_name ILIKE '%hamza%'
ORDER BY created_at DESC
LIMIT 5;

-- Update Hamza's order from Table 1 to Table 9
UPDATE orders 
SET 
    table_number = 9,
    source = 'qr',  -- Ensure it's marked as QR order for Table 9
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND total_amount = 13350  -- £133.50 in pence
  AND customer_name ILIKE '%hamza%'
  AND table_number = 1;  -- Only update if currently on table 1

-- Verify the change
SELECT 
    'After update - Hamza order should now be on Table 9:' as info,
    id,
    table_number,
    customer_name,
    total_amount,
    source,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND total_amount = 13350  -- £133.50 in pence
  AND customer_name ILIKE '%hamza%'
ORDER BY created_at DESC
LIMIT 5;

-- Also check Donald's order to ensure it's correctly marked as counter
SELECT 
    'Donald order should be Counter 9:' as info,
    id,
    table_number,
    customer_name,
    total_amount,
    source,
    created_at,
    items
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND total_amount = 4770  -- £47.70 in pence
  AND customer_name ILIKE '%donald%'
ORDER BY created_at DESC
LIMIT 5;

-- Update Donald's order to ensure it's marked as counter
UPDATE orders 
SET 
    source = 'counter',  -- Ensure it's marked as counter order
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND total_amount = 4770  -- £47.70 in pence
  AND customer_name ILIKE '%donald%'
  AND table_number = 9;

-- Final verification - show both orders
SELECT 
    'Final verification:' as info,
    id,
    table_number,
    customer_name,
    total_amount,
    source,
    CASE 
        WHEN source = 'counter' THEN CONCAT('Counter ', table_number)
        ELSE CONCAT('Table ', table_number)
    END as display_name,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND (
    (total_amount = 13350 AND customer_name ILIKE '%hamza%') OR
    (total_amount = 4770 AND customer_name ILIKE '%donald%')
  )
ORDER BY created_at DESC;