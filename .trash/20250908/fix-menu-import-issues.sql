-- =====================================================
-- MENU IMPORT ISSUES FIX SCRIPT
-- =====================================================
-- This script fixes the specific menu import issues identified:
-- 1. Modifier explosion (Coffee with a shot of X)
-- 2. £0.00 prices
-- 3. Misfiled items (lobster in coffee)
-- 4. Duplicates/near-duplicates
-- 5. Truncated descriptions
-- 6. Component items that should be removed
-- 7. Category validation

-- =====================================================
-- 1. FIX £0.00 PRICES
-- =====================================================

-- Fix Iced Black/Americano price
UPDATE menu_items 
SET price = 3.50 
WHERE name ILIKE '%iced black%' 
   OR name ILIKE '%iced americano%' 
   AND price = 0.00;

-- Fix Espresso price
UPDATE menu_items 
SET price = 3.20 
WHERE name ILIKE '%espresso%' 
   AND price = 0.00
   AND category = 'COFFEE';

-- Fix Flat White price
UPDATE menu_items 
SET price = 3.50 
WHERE name ILIKE '%flat white%' 
   AND price = 0.00;

-- Fix Cappuccino price
UPDATE menu_items 
SET price = 3.50 
WHERE name ILIKE '%cappuccino%' 
   AND price = 0.00;

-- Fix Latte price
UPDATE menu_items 
SET price = 3.50 
WHERE name ILIKE '%latte%' 
   AND price = 0.00
   AND category = 'COFFEE';

-- Fix Arabic Coffee Pot prices
UPDATE menu_items 
SET price = 10.00 
WHERE name ILIKE '%arabic coffee pot%' 
   AND (name ILIKE '%small%' OR name ILIKE '%s%')
   AND price = 0.00;

UPDATE menu_items 
SET price = 18.00 
WHERE name ILIKE '%arabic coffee pot%' 
   AND (name ILIKE '%large%' OR name ILIKE '%l%')
   AND price = 0.00;

-- =====================================================
-- 2. REMOVE MODIFIER EXPLOSION ITEMS
-- =====================================================

-- Remove all "Coffee with a shot of X" items
DELETE FROM menu_items 
WHERE name ILIKE '%coffee with a shot of%';

-- Remove "Alternative Milk" as standalone items (should be options)
DELETE FROM menu_items 
WHERE name ILIKE '%alternative milk%'
   OR name ILIKE '%oat milk%'
   OR name ILIKE '%coconut milk%'
   OR name ILIKE '%almond milk%'
   AND category IN ('COFFEE', 'TEA');

-- =====================================================
-- 3. FIX MISFILED ITEMS
-- =====================================================

-- Move lobster items from COFFEE to BRUNCH/MAINS
UPDATE menu_items 
SET category = 'BRUNCH' 
WHERE name ILIKE '%lobster%' 
   AND category = 'COFFEE';

-- Move any food items from COFFEE/TEA to appropriate categories
UPDATE menu_items 
SET category = 'BRUNCH' 
WHERE category = 'COFFEE' 
   AND (name ILIKE '%sandwich%' 
        OR name ILIKE '%salad%' 
        OR name ILIKE '%soup%' 
        OR name ILIKE '%pasta%' 
        OR name ILIKE '%pizza%' 
        OR name ILIKE '%burger%' 
        OR name ILIKE '%chicken%' 
        OR name ILIKE '%beef%' 
        OR name ILIKE '%fish%' 
        OR name ILIKE '%lobster%' 
        OR name ILIKE '%seafood%');

-- =====================================================
-- 4. REMOVE DUPLICATES AND NEAR-DUPLICATES
-- =====================================================

-- Remove corrupted Pour-Over duplicates (keep the clean one)
DELETE FROM menu_items 
WHERE name ILIKE '%pour-over%' 
   AND (name ILIKE '%öbös öö%' 
        OR name ILIKE '%corrupted%' 
        OR name ILIKE '%garbled%');

-- Keep only one Pour-Over (V60) item
WITH pour_over_items AS (
  SELECT id, name, price, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM menu_items 
  WHERE name ILIKE '%pour-over%' 
     OR name ILIKE '%v60%'
)
DELETE FROM menu_items 
WHERE id IN (
  SELECT id FROM pour_over_items WHERE rn > 1
);

-- Remove duplicate tea items (keep the longer, cleaner version)
DELETE FROM menu_items 
WHERE name IN ('Earl grey', 'Chamomile')
   AND id NOT IN (
     SELECT id 
     FROM (
       SELECT id, ROW_NUMBER() OVER (PARTITION BY LOWER(name) ORDER BY created_at) as rn
       FROM menu_items 
       WHERE name IN ('Earl grey', 'Chamomile')
     ) ranked
     WHERE rn = 1
   );

-- =====================================================
-- 5. FIX TRUNCATED DESCRIPTIONS
-- =====================================================

-- Fix "granular" to "granola" in descriptions
UPDATE menu_items 
SET description = REPLACE(description, 'granular', 'granola')
WHERE description ILIKE '%granular%';

-- Fix other common truncation issues
UPDATE menu_items 
SET description = REPLACE(description, 'overnight oat,', 'overnight oats,')
WHERE description ILIKE '%overnight oat,%';

-- =====================================================
-- 6. REMOVE COMPONENT ITEMS
-- =====================================================

-- Remove club sandwich, mini, wraps as standalone items
-- (they should only exist as part of sets like Afternoon Tea)
DELETE FROM menu_items 
WHERE name ILIKE '%club sandwich%'
   OR name ILIKE '%mini%'
   OR name ILIKE '%wraps%'
   AND price = 0.00;

-- Remove items that are clearly components of sets
DELETE FROM menu_items 
WHERE (name ILIKE '%halloumi%' 
       OR name ILIKE '%chicken%')
   AND price = 0.00
   AND category NOT IN ('MAINS', 'BRUNCH', 'STARTERS');

-- =====================================================
-- 7. VALIDATE AND CLEAN CATEGORIES
-- =====================================================

-- Ensure Afternoon Tea is properly set as one item
UPDATE menu_items 
SET price = 25.00, 
    description = 'Traditional afternoon tea with sandwiches, scones, and pastries. Minimum 2 people.'
WHERE name ILIKE '%afternoon tea%'
   AND price = 0.00;

-- Remove any remaining items with £0.00 prices that shouldn't exist
DELETE FROM menu_items 
WHERE price = 0.00 
   AND name NOT ILIKE '%afternoon tea%'
   AND name NOT ILIKE '%set menu%'
   AND name NOT ILIKE '%platter%';

-- =====================================================
-- 8. ADD PROPER SYRUP OPTIONS (if you have an options table)
-- =====================================================

-- Note: This assumes you have a menu_item_options table
-- If not, you'll need to create one or handle options differently

-- Create syrup options for coffee drinks
-- INSERT INTO menu_item_options (menu_item_id, option_name, option_price)
-- SELECT mi.id, 'Syrup (Salted Caramel / Hazelnut / French Vanilla)', 0.50
-- FROM menu_items mi
-- WHERE mi.category = 'COFFEE' 
--   AND (mi.name ILIKE '%latte%' 
--        OR mi.name ILIKE '%cappuccino%' 
--        OR mi.name ILIKE '%mocha%'
--        OR mi.name ILIKE '%americano%');

-- =====================================================
-- 9. FINAL VALIDATION
-- =====================================================

-- Show summary of fixes
SELECT 
  'Category Counts' as summary_type,
  category,
  COUNT(*) as item_count
FROM menu_items 
GROUP BY category
ORDER BY item_count DESC;

-- Show remaining zero-price items (should be minimal)
SELECT 
  'Remaining Zero Price Items' as summary_type,
  name,
  category,
  price
FROM menu_items 
WHERE price = 0.00;

-- Show coffee category items (should be reasonable count)
SELECT 
  'Coffee Items' as summary_type,
  name,
  price
FROM menu_items 
WHERE category = 'COFFEE'
ORDER BY name;

COMMIT;
