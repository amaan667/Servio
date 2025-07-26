-- =====================================================
-- VENUE ID FIX SCRIPT
-- =====================================================
-- This script helps fix venue ID issues if your database
-- has UUID venue columns instead of TEXT venue_id columns.

-- Check current table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('venues', 'menu_items', 'orders')
ORDER BY table_name, ordinal_position;

-- If venues.venue_id is UUID instead of TEXT, run these:

-- 1. Add a slug column to venues table
-- ALTER TABLE venues ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 2. Update existing venues with slug (if needed)
-- UPDATE venues SET slug = venue_id::text WHERE slug IS NULL;

-- 3. Add slug column to menu_items if it doesn't exist
-- ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS venue_slug TEXT;

-- 4. Update menu_items to have venue_slug
-- UPDATE menu_items SET venue_slug = venues.slug 
-- FROM venues 
-- WHERE menu_items.venue_id = venues.venue_id;

-- 5. Create index on venue_slug
-- CREATE INDEX IF NOT EXISTS idx_menu_items_venue_slug ON menu_items(venue_slug);

-- Check current data
SELECT 
    'venues' as table_name,
    COUNT(*) as count,
    'venue_id type: ' || data_type as info
FROM venues, information_schema.columns 
WHERE table_name = 'venues' AND column_name = 'venue_id'
UNION ALL
SELECT 
    'menu_items' as table_name,
    COUNT(*) as count,
    'venue_id type: ' || data_type as info
FROM menu_items, information_schema.columns 
WHERE table_name = 'menu_items' AND column_name = 'venue_id';

-- Show sample venue data
SELECT venue_id, name, created_at FROM venues LIMIT 5;

-- Show sample menu items
SELECT venue_id, name, price FROM menu_items LIMIT 5; 