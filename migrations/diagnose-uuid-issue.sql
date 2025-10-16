-- Diagnostic script to find all UUID casting issues in the database
-- Run this to identify exactly where the problem is occurring

-- 1. Check all existing RLS policies that use auth.uid()
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
WHERE qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%';

-- 2. Check the data types of columns that are being compared with auth.uid()
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('ai_chat_conversations', 'ai_conversations', 'ai_chat_messages', 'ai_messages')
  AND column_name IN ('user_id', 'created_by', 'owner_id')
ORDER BY table_name, column_name;

-- 3. Check if there are any existing policies on the tables we're trying to create
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('ai_chat_conversations', 'ai_chat_messages');

-- 4. Check what auth.uid() returns and its type
SELECT 
  'auth.uid()' as function_name,
  auth.uid() as result,
  pg_typeof(auth.uid()) as return_type;

-- 5. Test UUID casting explicitly
SELECT 
  'UUID casting test' as test_name,
  auth.uid()::uuid as cast_result,
  pg_typeof(auth.uid()::uuid) as cast_type;

-- 6. Check if there are any existing triggers or functions that might be causing issues
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('ai_chat_conversations', 'ai_chat_messages', 'ai_conversations', 'ai_messages');
