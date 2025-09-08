# Table Management Refactor - Deployment Guide

## 🎯 Overview

This deployment implements the complete table management refactor with layered state system, allowing tables to simultaneously reflect:
- **Current State**: FREE or OCCUPIED (live session)
- **Reservation State**: RESERVED_NOW, RESERVED_LATER, or NONE

## 📋 Pre-Deployment Checklist

- ✅ Code changes committed and pushed
- ✅ Build passes successfully
- ✅ Health check endpoints working
- ⏳ **Database migration pending** (see below)

## 🗄️ Database Migration Required

**CRITICAL**: You must run the database migration before the new table management system will work.

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query

### Step 2: Run the Migration Script

Copy and paste the entire contents of `scripts/table-management-refactor-complete.sql` into the SQL Editor and execute it.

**⚠️ Important Notes:**
- This script is **idempotent** - safe to run multiple times
- It will create/update views, functions, and add necessary columns
- No data will be lost
- The script includes proper error handling

### Step 3: Verify Migration Success

After running the script, verify these components exist:

```sql
-- Check that the view exists
SELECT * FROM table_runtime_state LIMIT 1;

-- Check that the function exists
SELECT api_table_counters('your-venue-id'::uuid);

-- Check that enums exist
SELECT unnest(enum_range(NULL::table_status));
SELECT unnest(enum_range(NULL::reservation_status));
```

## 🚀 Post-Deployment Verification

### 1. Health Check Endpoints

Test these endpoints to ensure they're working:

```bash
# Ultra-simple health check (Railway configured)
curl https://your-app.railway.app/api/status

# Alternative health checks
curl https://your-app.railway.app/api/health
curl https://your-app.railway.app/api/ping
```

### 2. Table Management API Endpoints

Test the new table management endpoints:

```bash
# Get tables with layered state
curl "https://your-app.railway.app/api/tables?venueId=your-venue-id"

# Get dashboard counters
curl "https://your-app.railway.app/api/tables/counters?venueId=your-venue-id"

# Get unassigned reservations
curl "https://your-app.railway.app/api/reservations/unassigned?venueId=your-venue-id"
```

### 3. Table Actions

Test the transactional actions:

```bash
# Seat a party
curl -X POST "https://your-app.railway.app/api/tables/table-id/seat" \
  -H "Content-Type: application/json" \
  -d '{"reservationId": "reservation-id", "serverId": "server-id"}'

# Close a table
curl -X POST "https://your-app.railway.app/api/tables/table-id/close"

# Assign reservation to table
curl -X POST "https://your-app.railway.app/api/reservations/reservation-id/assign" \
  -H "Content-Type: application/json" \
  -d '{"tableId": "table-id"}'

# Cancel reservation
curl -X POST "https://your-app.railway.app/api/reservations/reservation-id/cancel"
```

## 🎨 New Features Available

### 1. Layered Table State

Tables now display both states simultaneously:
- **Primary**: FREE (green) or OCCUPIED (amber)
- **Secondary**: RESERVED_NOW (red), RESERVED_LATER (purple), or NONE

### 2. Accurate Dashboard Counters

- `tables_set_up`: Total active tables
- `in_use_now`: Currently occupied tables
- `reserved_now`: Tables with overlapping reservations
- `reserved_later`: Tables with future reservations
- `waiting`: Unassigned reservations

### 3. Unassigned Reservations

Reservations can be created without a table assignment (`table_id = null`) and assigned later.

### 4. Transactional Actions

All table actions are now atomic and use database functions:
- `api_seat_party`: Seats a party, optionally marking reservation as CHECKED_IN
- `api_close_table`: Closes table and creates new FREE session
- `api_assign_reservation`: Assigns reservation to table
- `api_cancel_reservation`: Cancels reservation
- `api_no_show_reservation`: Marks reservation as NO_SHOW

## 🔧 Troubleshooting

### Health Check Failures

If Railway health checks fail:

1. **Check Railway logs** for specific error messages
2. **Verify environment variables** are set correctly
3. **Test endpoints manually** using curl
4. **Check database connection** in Supabase

### Database Issues

If table management doesn't work:

1. **Verify migration ran successfully** (check views and functions exist)
2. **Check table_sessions table** has `status` column
3. **Verify reservations table** has `status` column
4. **Test database functions** directly in Supabase SQL Editor

### API Errors

If API endpoints return errors:

1. **Check authentication** - ensure user is logged in
2. **Verify venue ownership** - user must own the venue
3. **Check request format** - ensure required fields are provided
4. **Review server logs** for detailed error messages

## 📊 Expected Behavior

### Before Migration
- Tables show single state (last action wins)
- Counters may be inaccurate
- Reservations overwrite table state

### After Migration
- Tables show layered state (FREE + RESERVED_LATER)
- Counters are accurate and truthful
- Live state and reservation state are independent
- Tables can be FREE now while RESERVED for 19:30

## 🎯 Success Criteria

✅ **Tables display layered state**: "FREE now and Reserved for 19:30"  
✅ **Counters are accurate**: No overwrites, truthful metrics  
✅ **Seating works**: Converts reservation to CHECKED_IN  
✅ **Closing works**: Blocks until paid, creates fresh FREE session  
✅ **Merged tables work**: Secondaries route to primary  
✅ **Filters work**: Reserved later/now behave correctly  
✅ **No "last action wins"**: Status layers are independent  

## 📞 Support

If you encounter issues:

1. Check the Railway deployment logs
2. Verify the database migration completed successfully
3. Test the health check endpoints
4. Review the API endpoint responses

The system is designed to be robust and handle edge cases gracefully. All database operations are transactional and include proper error handling.
