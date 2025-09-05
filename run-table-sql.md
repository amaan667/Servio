# Database Setup Required

The Table Management feature requires database tables to be created. Please run the following SQL in your Supabase dashboard:

## Steps:
1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `scripts/create-table-management-tables-safe.sql`
4. Run the SQL script

## Alternative: Use the SQL file directly
The safe SQL script is located at: `scripts/create-table-management-tables-safe.sql`

## If you get policy errors:
If you see "policy already exists" errors, use the safe version which handles existing policies gracefully by dropping and recreating them.

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
