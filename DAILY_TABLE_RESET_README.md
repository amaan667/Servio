# Daily Table Reset System

## Overview

The Daily Table Reset System automatically resets all restaurant tables to "FREE" status at the start of each new day. This ensures that every morning, all tables are available for new customers, regardless of their previous day's status.

## Features

- **Automatic Daily Reset**: All tables reset to FREE status at midnight every day
- **Manual Reset Capability**: Admin can trigger resets manually via API
- **Venue-Specific Reset**: Reset tables for a specific venue only
- **Reset Logging**: Track all reset operations for monitoring and debugging
- **Backup Reset**: Secondary reset at 6 AM as a safety measure
- **Log Cleanup**: Automatic cleanup of old reset logs

## How It Works

### Table Status Management

The system uses a session-based approach to track table status:

1. **Tables Table**: Stores physical table information (ID, label, seat count, etc.)
2. **Table Sessions Table**: Tracks the current status of each table
3. **Daily Reset**: Closes all active sessions and creates new FREE sessions

### Reset Process

1. **Close Active Sessions**: All current table sessions are marked as closed
2. **Create FREE Sessions**: New FREE sessions are created for all active tables
3. **Log Operation**: The reset operation is logged with details
4. **Update Counters**: Table counters are automatically updated

## Installation

### 1. Deploy Database Functions

```bash
# Run the deployment script
./deploy-daily-table-reset.sh
```

### 2. Manual Database Setup (Alternative)

If you prefer to set up manually:

```sql
-- Apply the daily reset functions
\i scripts/daily-table-reset.sql

-- Set up cron jobs (requires pg_cron extension)
\i scripts/setup-daily-reset-cron.sql
```

### 3. Test the System

```bash
# Run the test script
node test-daily-table-reset.js
```

## API Endpoints

### Manual Reset

**POST** `/api/admin/reset-tables`

Reset all tables or specific venue tables.

```json
// Reset all tables
{
  "resetType": "all"
}

// Reset specific venue
{
  "resetType": "venue",
  "venueId": "venue-12345"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "log_id": "uuid",
    "reset_sessions": 15,
    "venues_affected": 3,
    "reset_timestamp": "2024-01-01T00:00:00Z",
    "message": "Manual table reset completed successfully"
  }
}
```

### Get Reset Logs

**GET** `/api/admin/reset-tables?limit=10`

Get recent reset log entries.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "venue_id": null,
      "reset_type": "DAILY",
      "sessions_reset": 15,
      "venues_affected": 3,
      "reset_timestamp": "2024-01-01T00:00:00Z",
      "triggered_by": null,
      "notes": "Automatic daily reset"
    }
  ]
}
```

## Database Functions

### Core Functions

- `daily_table_reset()` - Basic daily reset function
- `daily_table_reset_with_log()` - Daily reset with logging
- `manual_table_reset(venue_id)` - Manual reset (all or specific venue)
- `reset_venue_tables(venue_id)` - Reset specific venue only

### Monitoring Functions

- `table_reset_logs` - Table storing all reset operations
- Cron jobs for automatic scheduling

## Scheduled Jobs

The system sets up three cron jobs:

1. **Daily Reset** (`daily-table-reset`)
   - Schedule: `0 0 * * *` (midnight daily)
   - Function: `daily_table_reset_with_log()`

2. **Backup Reset** (`daily-table-reset-backup`)
   - Schedule: `0 6 * * *` (6 AM daily)
   - Function: `daily_table_reset_with_log()`

3. **Log Cleanup** (`cleanup-reset-logs`)
   - Schedule: `0 2 * * 0` (2 AM Sunday)
   - Function: Clean up logs older than 30 days

## Monitoring

### Check Reset Logs

```sql
SELECT 
  reset_type,
  sessions_reset,
  venues_affected,
  reset_timestamp,
  notes
FROM table_reset_logs 
ORDER BY reset_timestamp DESC 
LIMIT 10;
```

### Check Cron Job Status

```sql
SELECT 
  jobname,
  last_run,
  next_run,
  status
FROM cron.job_run_details 
WHERE jobname = 'daily-table-reset'
ORDER BY start_time DESC 
LIMIT 5;
```

### Check Current Table Status

```sql
SELECT 
  t.venue_id,
  t.label,
  ts.status,
  ts.opened_at
FROM tables t
LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.closed_at IS NULL
WHERE t.is_active = true
ORDER BY t.venue_id, t.label;
```

## Configuration

### Prerequisites

- **pg_cron Extension**: Must be enabled in Supabase project
- **Service Role Key**: Required for API endpoints
- **Authenticated Users**: Must have proper RLS policies

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Troubleshooting

### Common Issues

1. **Cron Jobs Not Running**
   - Check if pg_cron extension is enabled
   - Verify cron job exists: `SELECT * FROM cron.job;`
   - Check cron job status: `SELECT * FROM cron.job_run_details;`

2. **Reset Function Fails**
   - Check table structure exists
   - Verify RLS policies allow function execution
   - Check function permissions

3. **API Endpoint Errors**
   - Verify authentication
   - Check service role key
   - Ensure proper request format

### Manual Testing

```sql
-- Test manual reset
SELECT public.manual_table_reset();

-- Test venue-specific reset
SELECT public.reset_venue_tables('your-venue-id');

-- Check results
SELECT * FROM table_reset_logs ORDER BY reset_timestamp DESC LIMIT 5;
```

## Security

- All functions use `SECURITY DEFINER` for proper permissions
- API endpoints require authentication
- Reset logs track who triggered manual resets
- RLS policies protect sensitive data

## Performance

- Reset operations are optimized for large numbers of tables
- Logging is minimal to avoid performance impact
- Automatic log cleanup prevents table bloat
- Indexes on reset logs for efficient querying

## Support

For issues or questions:

1. Check the reset logs for error details
2. Verify cron job status
3. Test manual reset functions
4. Check database permissions and RLS policies

## Changelog

- **v1.0.0**: Initial implementation with daily reset and logging
- **v1.1.0**: Added venue-specific reset capability
- **v1.2.0**: Added API endpoints for manual control
- **v1.3.0**: Added backup reset and log cleanup jobs
