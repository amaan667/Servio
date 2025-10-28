-- Check RLS policies for menu_design_settings table
-- Run this in Supabase SQL Editor

-- 1. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'menu_design_settings';

-- 2. Show all policies on the table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'menu_design_settings';

-- 3. Try a test upsert with minimal data
-- REPLACE 'your-venue-id' with your actual venue_id
INSERT INTO menu_design_settings (
  venue_id, 
  venue_name, 
  logo_size_numeric
) VALUES (
  'venue-1e02af4d',  -- Replace with your venue_id
  'Test Venue',
  200
)
ON CONFLICT (venue_id) 
DO UPDATE SET 
  venue_name = EXCLUDED.venue_name,
  logo_size_numeric = EXCLUDED.logo_size_numeric,
  updated_at = now()
RETURNING *;

