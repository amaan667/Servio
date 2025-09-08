# Database Setup Required

The Table Management feature requires database tables to be created. Please run the following SQL in your Supabase dashboard:

## Option 1: Complete Setup (Recommended)
1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `scripts/create-table-management-tables-safe.sql`
4. Run the SQL script

## Option 2: If you get "qr_version column does not exist" error
If you already have tables but missing the qr_version column:
1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `scripts/add-qr-version-column.sql`
4. Run the migration script

## Alternative: Use the SQL files directly
- Complete setup: `scripts/create-table-management-tables-safe.sql`
- Migration only: `scripts/add-qr-version-column.sql`

## Common Errors:
- **"policy already exists"** → Use the safe version which handles existing policies gracefully
- **"qr_version column does not exist"** → Run the migration script first

## What this creates:
- `tables` table with columns: id, venue_id, label, seat_count, is_active, qr_version, created_at, updated_at
- `table_sessions` table for tracking table occupancy and status
- RLS policies for security
- Triggers for automatic timestamps
- A view `tables_with_sessions` for optimized queries

## After running the SQL:
- Tables can be created via the UI
- The Table Management page will show your tables
- QR codes can be generated for each table
