-- Create Orders for All Tabs - Comprehensive Script
-- This script will create orders that will appear in Live Orders, Earlier Today, and History tabs

-- ============================================================================
-- STEP 1: Clear existing orders for clean testing (optional)
-- ============================================================================

-- Uncomment the next line if you want to start fresh
-- DELETE FROM orders WHERE venue_id = 'venue-1e02af4d';

-- ============================================================================
-- STEP 2: Create LIVE ORDERS (Last 30 minutes) - 5 orders
-- ============================================================================

INSERT INTO orders (
    venue_id, 
    table_number, 
    customer_name, 
    customer_phone, 
    items, 
    total_amount, 
    order_status, 
    payment_status, 
    created_at, 
    updated_at
) VALUES 
-- Live Order 1 (5 minutes ago)
('venue-1e02af4d', 1, 'Alice Johnson', '+1234567890', 
 '[{"menu_item_id": "burger-1", "quantity": 1, "price": 12.50, "item_name": "Classic Burger"}]'::jsonb, 
 1250, 'PLACED', 'PAID', NOW() - INTERVAL '5 minutes', NOW()),

-- Live Order 2 (10 minutes ago)
('venue-1e02af4d', 2, 'Bob Smith', '+1234567891', 
 '[{"menu_item_id": "pizza-1", "quantity": 1, "price": 15.00, "item_name": "Margherita Pizza"}]'::jsonb, 
 1500, 'IN_PREP', 'PAID', NOW() - INTERVAL '10 minutes', NOW()),

-- Live Order 3 (15 minutes ago)
('venue-1e02af4d', 3, 'Carol Davis', '+1234567892', 
 '[{"menu_item_id": "pasta-1", "quantity": 1, "price": 13.75, "item_name": "Spaghetti Carbonara"}]'::jsonb, 
 1375, 'READY', 'PAID', NOW() - INTERVAL '15 minutes', NOW()),

-- Live Order 4 (20 minutes ago)
('venue-1e02af4d', 4, 'David Wilson', '+1234567893', 
 '[{"menu_item_id": "salad-1", "quantity": 1, "price": 9.50, "item_name": "Caesar Salad"}]'::jsonb, 
 950, 'SERVING', 'PAID', NOW() - INTERVAL '20 minutes', NOW()),

-- Live Order 5 (25 minutes ago)
('venue-1e02af4d', 5, 'Emma Brown', '+1234567894', 
 '[{"menu_item_id": "drink-1", "quantity": 2, "price": 3.50, "item_name": "Fresh Orange Juice"}]'::jsonb, 
 700, 'COMPLETED', 'PAID', NOW() - INTERVAL '25 minutes', NOW());

-- ============================================================================
-- STEP 3: Create EARLIER TODAY ORDERS (Today but >30 minutes ago) - 6 orders
-- ============================================================================

INSERT INTO orders (
    venue_id, 
    table_number, 
    customer_name, 
    customer_phone, 
    items, 
    total_amount, 
    order_status, 
    payment_status, 
    created_at, 
    updated_at
) VALUES 
-- Earlier Today Order 1 (1 hour ago)
('venue-1e02af4d', 1, 'Frank Miller', '+1234567895', 
 '[{"menu_item_id": "steak-1", "quantity": 1, "price": 24.99, "item_name": "Ribeye Steak"}]'::jsonb, 
 2499, 'COMPLETED', 'PAID', NOW() - INTERVAL '1 hour', NOW()),

-- Earlier Today Order 2 (2 hours ago)
('venue-1e02af4d', 2, 'Grace Lee', '+1234567896', 
 '[{"menu_item_id": "soup-1", "quantity": 1, "price": 8.25, "item_name": "Tomato Soup"}]'::jsonb, 
 825, 'COMPLETED', 'PAID', NOW() - INTERVAL '2 hours', NOW()),

-- Earlier Today Order 3 (3 hours ago)
('venue-1e02af4d', 3, 'Henry Taylor', '+1234567897', 
 '[{"menu_item_id": "sandwich-1", "quantity": 1, "price": 11.50, "item_name": "Club Sandwich"}]'::jsonb, 
 1150, 'COMPLETED', 'PAID', NOW() - INTERVAL '3 hours', NOW()),

-- Earlier Today Order 4 (4 hours ago)
('venue-1e02af4d', 4, 'Ivy Chen', '+1234567898', 
 '[{"menu_item_id": "wrap-1", "quantity": 1, "price": 10.75, "item_name": "Chicken Wrap"}]'::jsonb, 
 1075, 'COMPLETED', 'PAID', NOW() - INTERVAL '4 hours', NOW()),

-- Earlier Today Order 5 (5 hours ago)
('venue-1e02af4d', 5, 'Jack Anderson', '+1234567899', 
 '[{"menu_item_id": "curry-1", "quantity": 1, "price": 16.50, "item_name": "Chicken Curry"}]'::jsonb, 
 1650, 'COMPLETED', 'PAID', NOW() - INTERVAL '5 hours', NOW()),

-- Earlier Today Order 6 (6 hours ago)
('venue-1e02af4d', 6, 'Kate Rodriguez', '+1234567800', 
 '[{"menu_item_id": "tacos-1", "quantity": 3, "price": 4.50, "item_name": "Fish Tacos"}]'::jsonb, 
 1350, 'COMPLETED', 'PAID', NOW() - INTERVAL '6 hours', NOW());

-- ============================================================================
-- STEP 4: Create HISTORY ORDERS (Previous days) - 8 orders
-- ============================================================================

INSERT INTO orders (
    venue_id, 
    table_number, 
    customer_name, 
    customer_phone, 
    items, 
    total_amount, 
    order_status, 
    payment_status, 
    created_at, 
    updated_at
) VALUES 
-- History Order 1 (1 day ago)
('venue-1e02af4d', 1, 'Liam Connor', '+1234567801', 
 '[{"menu_item_id": "fish-1", "quantity": 1, "price": 18.99, "item_name": "Grilled Salmon"}]'::jsonb, 
 1899, 'COMPLETED', 'PAID', NOW() - INTERVAL '1 day', NOW()),

-- History Order 2 (2 days ago)
('venue-1e02af4d', 2, 'Maya Patel', '+1234567802', 
 '[{"menu_item_id": "risotto-1", "quantity": 1, "price": 14.25, "item_name": "Mushroom Risotto"}]'::jsonb, 
 1425, 'COMPLETED', 'PAID', NOW() - INTERVAL '2 days', NOW()),

-- History Order 3 (3 days ago)
('venue-1e02af4d', 3, 'Noah Kim', '+1234567803', 
 '[{"menu_item_id": "ramen-1", "quantity": 1, "price": 12.75, "item_name": "Tonkotsu Ramen"}]'::jsonb, 
 1275, 'COMPLETED', 'PAID', NOW() - INTERVAL '3 days', NOW()),

-- History Order 4 (4 days ago)
('venue-1e02af4d', 4, 'Olivia Garcia', '+1234567804', 
 '[{"menu_item_id": "sushi-1", "quantity": 1, "price": 22.50, "item_name": "Sushi Platter"}]'::jsonb, 
 2250, 'COMPLETED', 'PAID', NOW() - INTERVAL '4 days', NOW()),

-- History Order 5 (5 days ago)
('venue-1e02af4d', 5, 'Peter Johnson', '+1234567805', 
 '[{"menu_item_id": "lobster-1", "quantity": 1, "price": 35.00, "item_name": "Lobster Roll"}]'::jsonb, 
 3500, 'COMPLETED', 'PAID', NOW() - INTERVAL '5 days', NOW()),

-- History Order 6 (1 week ago)
('venue-1e02af4d', 6, 'Quinn Williams', '+1234567806', 
 '[{"menu_item_id": "pasta-2", "quantity": 1, "price": 13.25, "item_name": "Fettuccine Alfredo"}]'::jsonb, 
 1325, 'COMPLETED', 'PAID', NOW() - INTERVAL '1 week', NOW()),

-- History Order 7 (2 weeks ago)
('venue-1e02af4d', 7, 'Rachel Brown', '+1234567807', 
 '[{"menu_item_id": "burger-2", "quantity": 1, "price": 11.99, "item_name": "Veggie Burger"}]'::jsonb, 
 1199, 'COMPLETED', 'PAID', NOW() - INTERVAL '2 weeks', NOW()),

-- History Order 8 (3 weeks ago)
('venue-1e02af4d', 8, 'Sam Davis', '+1234567808', 
 '[{"menu_item_id": "pizza-2", "quantity": 1, "price": 16.75, "item_name": "Pepperoni Pizza"}]'::jsonb, 
 1675, 'COMPLETED', 'PAID', NOW() - INTERVAL '3 weeks', NOW());

-- ============================================================================
-- STEP 5: Verify the results
-- ============================================================================

-- Show total distribution
SELECT 
    'FINAL ORDER DISTRIBUTION' as info,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 1 END) as live_orders,
    COUNT(CASE WHEN created_at >= DATE_TRUNC('day', NOW()) AND created_at < NOW() - INTERVAL '30 minutes' THEN 1 END) as earlier_today_orders,
    COUNT(CASE WHEN created_at < DATE_TRUNC('day', NOW()) THEN 1 END) as history_orders
FROM orders
WHERE venue_id = 'venue-1e02af4d';

-- Show Live Orders (should be 5)
SELECT 
    'LIVE ORDERS (Last 30 min)' as tab,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;

-- Show Earlier Today Orders (should be 6)
SELECT 
    'EARLIER TODAY ORDERS' as tab,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at >= DATE_TRUNC('day', NOW())
  AND created_at < NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;

-- Show History Orders (should be 8)
SELECT 
    'HISTORY ORDERS' as tab,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at < DATE_TRUNC('day', NOW())
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
    'SUMMARY' as info,
    '✅ Created 5 Live Orders (last 30 minutes)' as live_orders,
    '✅ Created 6 Earlier Today Orders (today but >30 min ago)' as earlier_today_orders,
    '✅ Created 8 History Orders (previous days)' as history_orders,
    '✅ All orders have PAID status for visibility' as payment_status,
    '✅ All orders have realistic data and timestamps' as data_quality,
    '🔄 Refresh your Live Orders page to see the results!' as next_step;
