-- =====================================================
-- DAILY TABLE RESET CRON SETUP
-- =====================================================
-- This script sets up the daily table reset using Supabase's pg_cron extension
-- Note: pg_cron must be enabled in your Supabase project

-- =====================================================
-- 1. ENABLE PG_CRON EXTENSION (if not already enabled)
-- =====================================================
-- Uncomment the following line if pg_cron is not enabled:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- 2. CREATE DAILY RESET CRON JOB
-- =====================================================
-- Schedule the daily table reset to run at midnight every day
-- This will reset all tables to FREE status automatically

-- Remove existing job if it exists
SELECT cron.unschedule('daily-table-reset');

-- Schedule the daily reset job
SELECT cron.schedule(
  'daily-table-reset',
  '0 0 * * *', -- Run at midnight (00:00) every day
  'SELECT public.daily_table_reset_with_log();'
);

-- =====================================================
-- 3. CREATE BACKUP CRON JOB (optional)
-- =====================================================
-- Schedule a backup reset at 6 AM in case the midnight reset fails
-- This provides redundancy for the daily reset

SELECT cron.unschedule('daily-table-reset-backup');

SELECT cron.schedule(
  'daily-table-reset-backup',
  '0 6 * * *', -- Run at 6 AM every day
  'SELECT public.daily_table_reset_with_log();'
);

-- =====================================================
-- 4. CREATE WEEKLY CLEANUP JOB (optional)
-- =====================================================
-- Clean up old reset logs to prevent table bloat
-- Keeps only the last 30 days of reset logs

SELECT cron.unschedule('cleanup-reset-logs');

SELECT cron.schedule(
  'cleanup-reset-logs',
  '0 2 * * 0', -- Run at 2 AM every Sunday
  'DELETE FROM table_reset_logs WHERE reset_timestamp < NOW() - INTERVAL ''30 days'';'
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
WHERE jobname IN ('daily-table-reset', 'daily-table-reset-backup', 'cleanup-reset-logs')
ORDER BY jobname;

-- =====================================================
-- 6. MANUAL TESTING
-- =====================================================
-- Test the reset function manually to ensure it works

-- Test the daily reset function
SELECT public.daily_table_reset_with_log();

-- Check the reset logs
SELECT * FROM table_reset_logs ORDER BY reset_timestamp DESC LIMIT 5;

-- =====================================================
-- 7. MONITORING QUERIES
-- =====================================================
-- Useful queries for monitoring the daily reset system

-- Check recent reset logs
-- SELECT 
--   reset_type,
--   sessions_reset,
--   venues_affected,
--   reset_timestamp,
--   notes
-- FROM table_reset_logs 
-- ORDER BY reset_timestamp DESC 
-- LIMIT 10;

-- Check current table status after reset
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
-- WHERE jobname = 'daily-table-reset'
-- ORDER BY start_time DESC 
-- LIMIT 5;
