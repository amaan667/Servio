-- Clear test data that might be causing dashboard inconsistencies
-- Run this in your Supabase SQL editor if you want to start fresh

-- Show current data before clearing
SELECT 
    'Current orders count:' as info,
    COUNT(*) as total_orders
FROM orders;

SELECT 
    'Orders by status:' as info,
    order_status,
    COUNT(*) as count
FROM orders 
GROUP BY order_status;

SELECT 
    'Orders by payment status:' as info,
    payment_status,
    COUNT(*) as count
FROM orders 
GROUP BY payment_status;

-- Clear all orders (uncomment if you want to start fresh)
-- DELETE FROM orders;

-- Clear menu items (uncomment if you want to start fresh)
-- DELETE FROM menu_items WHERE venue_id = 'demo-cafe';

-- Re-insert demo menu items
INSERT INTO menu_items (venue_id, name, description, price, category, available, prep_time, rating) VALUES
('demo-cafe', 'Virgin Margarita', 'Lime, lemon & orange juice served chilled.', 3.00, 'Beverages', true, 5, 4.5),
('demo-cafe', 'Mountain Of 50 Prawns', '50 succulent medium Prawns with rice.', 47.50, 'Weekly Specials', true, 20, 4.8),
('demo-cafe', 'Coca-Cola', 'Classic Coca-Cola served chilled.', 2.50, 'Beverages', true, 2, 4.0),
('demo-cafe', 'Margherita Pizza', 'Fresh mozzarella, tomato sauce, and basil.', 12.99, 'Pizza', true, 15, 4.6),
('demo-cafe', 'Caesar Salad', 'Romaine lettuce, parmesan cheese, croutons with caesar dressing.', 8.99, 'Salads', true, 8, 4.3)
ON CONFLICT DO NOTHING;

-- Show final state
SELECT 
    'Final orders count:' as info,
    COUNT(*) as total_orders
FROM orders;

SELECT 
    'Final menu items count:' as info,
    COUNT(*) as total_menu_items
FROM menu_items;
