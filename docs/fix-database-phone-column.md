# Fix Database Phone Column Error

## Problem
You may encounter an error like "Could not find the 'phone' column of 'venues' in the schema cache" when setting up your profile. This indicates that the database schema is not in sync with the expected structure.

## Solution

### Option 1: Run the Migration Script (Recommended)
Execute the SQL migration script to safely add the phone column if it doesn't exist:

```bash
# If using Supabase CLI
supabase db reset

# Or run the migration script directly in your Supabase SQL editor:
# Copy and paste the contents of scripts/add-phone-to-venues.sql
```

### Option 2: Manual Database Update
If you have direct access to your database, run this SQL command:

```sql
-- Add phone column to venues table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'venues' 
        AND column_name = 'phone'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE venues ADD COLUMN phone TEXT;
        RAISE NOTICE 'Added phone column to venues table';
    ELSE
        RAISE NOTICE 'Phone column already exists in venues table';
    END IF;
END $$;
```

### Option 3: Full Schema Reset
If you're starting fresh and don't mind losing existing data:

1. Go to your Supabase dashboard
2. Navigate to the SQL editor
3. Copy and paste the entire contents of `scripts/database-schema.sql`
4. Execute the script

## Prevention
To prevent this issue in the future:
- Always run database migrations when deploying schema changes
- Use the provided `database-schema.sql` as your source of truth
- Consider using Supabase migrations for production environments

## Files Modified
- `scripts/add-phone-to-venues.sql` - Migration script to add the phone column
- `components/global-nav.tsx` - Improved logo positioning and responsive design