-- Test script to check migration readiness
-- Run this first to see what tables exist and what needs to be migrated

-- Check if old tables exist
SELECT 
  'ai_conversations' as table_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_conversations') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status,
  (SELECT COUNT(*) FROM ai_conversations) as record_count
UNION ALL
SELECT 
  'ai_messages' as table_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_messages') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status,
  (SELECT COUNT(*) FROM ai_messages) as record_count;

-- Check if new tables exist
SELECT 
  'ai_chat_conversations' as table_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_chat_conversations') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status,
  (SELECT COUNT(*) FROM ai_chat_conversations) as record_count
UNION ALL
SELECT 
  'ai_chat_messages' as table_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_chat_messages') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as status,
  (SELECT COUNT(*) FROM ai_chat_messages) as record_count;

-- Check auth.uid() function
SELECT 
  'auth.uid() test' as test_name,
  auth.uid() as result,
  pg_typeof(auth.uid()) as type;

-- Test UUID casting
SELECT 
  'UUID casting test' as test_name,
  auth.uid()::uuid as cast_result,
  pg_typeof(auth.uid()::uuid) as cast_type;
