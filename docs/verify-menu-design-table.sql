-- Run this in Supabase SQL Editor to verify the table structure

-- 1. Check if table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'menu_design_settings'
);

-- 2. Show all columns in the table (if it exists)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'menu_design_settings'
ORDER BY ordinal_position;

-- 3. Show sample row if any exist
SELECT *
FROM menu_design_settings
LIMIT 1;

