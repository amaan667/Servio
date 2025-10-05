# Daily Reset System Troubleshooting Guide

## Overview
The daily reset system automatically resets all tables, completes active orders, and cancels reservations at a scheduled time each day. This guide helps you troubleshoot and fix issues with the daily reset functionality.

## Current Issues Identified

### 1. Missing Database Column
**Problem**: The `daily_reset_time` column may not exist in the `venues` table.

**Solution**: Run the database migration script:
```sql
-- Run this in your Supabase SQL editor
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'venues' 
        AND column_name = 'daily_reset_time'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE venues ADD COLUMN daily_reset_time TIME;
        RAISE NOTICE 'Added daily_reset_time column to venues table';
    ELSE
        RAISE NOTICE 'daily_reset_time column already exists in venues table';
    END IF;
END $$;

-- Set default reset time to midnight for existing venues
UPDATE venues 
SET daily_reset_time = '00:00:00' 
WHERE daily_reset_time IS NULL;
```

### 2. Missing Environment Variable
**Problem**: The `CRON_SECRET` environment variable is not set.

**Solution**: 
1. Go to your Railway dashboard
2. Navigate to your project settings
3. Add the environment variable:
   - Key: `CRON_SECRET`
   - Value: `your-secret-key-here` (use a strong, random string)

### 3. Cron Job Configuration
**Problem**: The cron job may not be running or may have authentication issues.

**Solution**: The cron job is configured in `railway.toml`:
```toml
# Cron job for daily reset at midnight
[[cron]]
schedule = "0 0 * * *"
command = "curl -X POST -H 'Authorization: Bearer $CRON_SECRET' $RAILWAY_PUBLIC_DOMAIN/api/cron/daily-reset"

# Additional cron job for every hour to check for venue-specific reset times
[[cron]]
schedule = "0 * * * *"
command = "curl -X POST -H 'Authorization: Bearer $CRON_SECRET' $RAILWAY_PUBLIC_DOMAIN/api/cron/daily-reset"
```

## Testing the Reset System

### 1. Manual Reset (Immediate)
Use the manual reset endpoint to test the reset functionality:

```bash
curl -X POST https://your-domain.com/api/daily-reset/manual \
  -H "Content-Type: application/json" \
  -d '{"venueId": "your-venue-id"}'
```

### 2. Check Reset Status
Check if a venue needs reset:

```bash
curl "https://your-domain.com/api/daily-reset?venueId=your-venue-id"
```

### 3. Test Cron Endpoint
Test the cron endpoint directly:

```bash
curl -X POST https://your-domain.com/api/cron/daily-reset \
  -H "Authorization: Bearer your-cron-secret"
```

## Configuration

### Setting Reset Time for a Venue
1. Go to your venue dashboard
2. Navigate to Settings
3. Set the daily reset time (24-hour format)
4. The system will reset within 5 minutes of the scheduled time

### Default Reset Times
- **00:00 (Midnight)**: Standard reset at start of day
- **04:00 (4 AM)**: Late night venues that close after midnight  
- **06:00 (6 AM)**: Early morning venues

## What Gets Reset

When the daily reset runs, it:

1. **Completes all active orders** (PLACED, ACCEPTED, IN_PREP, READY, SERVING → COMPLETED)
2. **Cancels all active reservations** (BOOKED → CANCELLED)
3. **Deletes all tables** (complete reset)
4. **Clears table sessions and runtime state**
5. **Logs the reset** in the `daily_reset_log` table

## Monitoring

### Check Reset Logs
Query the reset log to see when resets were performed:

```sql
SELECT * FROM daily_reset_log 
WHERE venue_id = 'your-venue-id' 
ORDER BY reset_timestamp DESC;
```

### Check Venue Reset Times
```sql
SELECT venue_id, name, daily_reset_time 
FROM venues 
WHERE daily_reset_time IS NOT NULL;
```

## Troubleshooting Steps

1. **Check if the database column exists**:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'venues' AND column_name = 'daily_reset_time';
   ```

2. **Verify environment variables are set**:
   - Check Railway dashboard for `CRON_SECRET`
   - Ensure `RAILWAY_PUBLIC_DOMAIN` is set

3. **Test the cron endpoint manually**:
   ```bash
   curl -X POST https://your-domain.com/api/cron/daily-reset \
     -H "Authorization: Bearer your-cron-secret"
   ```

4. **Check application logs** for error messages

5. **Verify venue has reset time set**:
   ```sql
   SELECT venue_id, name, daily_reset_time FROM venues;
   ```

## Files Modified

- `railway.toml` - Added hourly cron job for venue-specific reset times
- `app/api/cron/daily-reset/route.ts` - Improved error handling for missing column
- `scripts/add-daily-reset-time-column.sql` - Database migration script
- `app/api/daily-reset/manual/route.ts` - Manual reset endpoint for testing

## Next Steps

1. Run the database migration script
2. Set the `CRON_SECRET` environment variable
3. Test the manual reset endpoint
4. Verify the cron job is working
5. Set reset times for your venues

The daily reset should now work properly and reset your tables every day at the scheduled time.