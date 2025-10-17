-- Debug PDF Images Issue
-- Run this in Supabase SQL Editor to diagnose the problem

-- 1. Check if pdf_images column exists
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'menu_uploads'
ORDER BY ordinal_position;

-- 2. Check all menu uploads for your venue
-- Replace 'YOUR_VENUE_ID' with your actual venue ID
SELECT 
  id,
  venue_id,
  filename,
  storage_path,
  pdf_images,
  array_length(pdf_images, 1) as pdf_images_count,
  category_order,
  file_size,
  extracted_text_length,
  created_at
FROM menu_uploads
WHERE venue_id = 'YOUR_VENUE_ID'  -- Replace with your venue ID
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check if there are ANY menu uploads with pdf_images
SELECT 
  COUNT(*) as total_uploads,
  COUNT(pdf_images) as uploads_with_pdf_images,
  COUNT(*) FILTER (WHERE array_length(pdf_images, 1) > 0) as uploads_with_valid_images
FROM menu_uploads;

-- 4. Check the most recent uploads across all venues
SELECT 
  venue_id,
  filename,
  array_length(pdf_images, 1) as pdf_images_count,
  created_at
FROM menu_uploads
WHERE pdf_images IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check storage bucket
SELECT 
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE name = 'menus';

-- 6. Check storage files (if you have access)
SELECT 
  name,
  bucket_id,
  owner,
  created_at,
  updated_at,
  last_accessed_at,
  metadata
FROM storage.objects
WHERE bucket_id = 'menus'
ORDER BY created_at DESC
LIMIT 10;

