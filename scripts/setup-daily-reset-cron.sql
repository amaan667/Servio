-- =====================================================
-- DAILY TABLE DELETION CRON SETUP
-- =====================================================
-- This script sets up the daily table deletion using Supabase's pg_cron extension
-- Note: pg_cron must be enabled in your Supabase project

-- =====================================================
-- 1. ENABLE PG_CRON EXTENSION (if not already enabled)
-- =====================================================
-- Uncomment the following line if pg_cron is not enabled:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- 2. CREATE DAILY DELETION CRON JOB
-- =====================================================
-- Schedule the daily table deletion to run at midnight every day
-- This will completely delete all tables, making the count go to 0

-- Remove existing job if it exists
SELECT cron.unschedule('daily-table-deletion');

-- Schedule the daily deletion job
SELECT cron.schedule(
  'daily-table-deletion',
  '0 0 * * *', -- Run at midnight (00:00) every day
  'SELECT public.daily_table_deletion_with_log();'
);

-- =====================================================
-- 3. CREATE BACKUP CRON JOB (optional)
-- =====================================================
-- Schedule a backup deletion at 6 AM in case the midnight deletion fails
-- This provides redundancy for the daily deletion

SELECT cron.unschedule('daily-table-deletion-backup');

SELECT cron.schedule(
  'daily-table-deletion-backup',
  '0 6 * * *', -- Run at 6 AM every day
  'SELECT public.daily_table_deletion_with_log();'
);

-- =====================================================
-- 4. CREATE WEEKLY CLEANUP JOB (optional)
-- =====================================================
-- Clean up old deletion logs to prevent table bloat
-- Keeps only the last 30 days of deletion logs

SELECT cron.unschedule('cleanup-deletion-logs');

SELECT cron.schedule(
  'cleanup-deletion-logs',
  '0 2 * * 0', -- Run at 2 AM every Sunday
  'DELETE FROM table_deletion_logs WHERE deletion_timestamp < NOW() - INTERVAL ''30 days'';'
);

-- =====================================================
-- 5. VERIFY CRON JOBS
-- =====================================================
-- Check that the cron jobs were created successfully

SELECT 
  jobname,
  schedule,
  command,
  active
FROM cron.job 
WHERE jobname IN ('daily-table-deletion', 'daily-table-deletion-backup', 'cleanup-deletion-logs')
ORDER BY jobname;

-- =====================================================
-- 6. MANUAL TESTING
-- =====================================================
-- Test the deletion function manually to ensure it works

-- Test the daily deletion function
SELECT public.daily_table_deletion_with_log();

-- Check the deletion logs
SELECT * FROM table_deletion_logs ORDER BY deletion_timestamp DESC LIMIT 5;

-- =====================================================
-- 7. MONITORING QUERIES
-- =====================================================
-- Useful queries for monitoring the daily deletion system

-- Check recent deletion logs
-- SELECT 
--   deletion_type,
--   tables_deleted,
--   sessions_deleted,
--   venues_affected,
--   deletion_timestamp,
--   notes
-- FROM table_deletion_logs 
-- ORDER BY deletion_timestamp DESC 
-- LIMIT 10;

-- Check current table status after deletion (should be empty)
-- SELECT 
--   t.venue_id,
--   t.label,
--   ts.status,
--   ts.opened_at
-- FROM tables t
-- LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.closed_at IS NULL
-- WHERE t.is_active = true
-- ORDER BY t.venue_id, t.label;

-- Check cron job status
-- SELECT 
--   jobname,
--   last_run,
--   next_run,
--   status
-- FROM cron.job_run_details 
-- WHERE jobname = 'daily-table-deletion'
-- ORDER BY start_time DESC 
-- LIMIT 5;
