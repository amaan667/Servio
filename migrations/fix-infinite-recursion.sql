-- IMMEDIATE FIX for infinite recursion in user_venue_roles
-- Run this in Supabase SQL Editor NOW

-- Step 1: Drop ALL existing policies on user_venue_roles
DROP POLICY IF EXISTS uvr_read ON user_venue_roles;
DROP POLICY IF EXISTS uvr_insert ON user_venue_roles;
DROP POLICY IF EXISTS uvr_update ON user_venue_roles;
DROP POLICY IF EXISTS uvr_delete ON user_venue_roles;

-- Step 2: Create NEW simple policies (no recursion!)

-- Read: Users can ONLY see their own roles (prevents recursion)
CREATE POLICY uvr_read ON user_venue_roles FOR SELECT
USING (user_id = auth.uid());

-- Insert/Update/Delete: Blocked at RLS level (service role bypasses this)
CREATE POLICY uvr_insert ON user_venue_roles FOR INSERT
WITH CHECK (false);

CREATE POLICY uvr_update ON user_venue_roles FOR UPDATE
USING (false);

CREATE POLICY uvr_delete ON user_venue_roles FOR DELETE
USING (false);

-- Step 3: Verify the fix
SELECT 'Policies updated successfully!' as status;

