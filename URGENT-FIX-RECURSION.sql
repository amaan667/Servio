-- ========================================
-- URGENT FIX: Stop infinite recursion NOW
-- Run this IMMEDIATELY in Supabase SQL Editor
-- ========================================

-- Step 1: DISABLE RLS temporarily on user_venue_roles
ALTER TABLE user_venue_roles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL old policies
DROP POLICY IF EXISTS uvr_read ON user_venue_roles;
DROP POLICY IF EXISTS uvr_insert ON user_venue_roles;
DROP POLICY IF EXISTS uvr_update ON user_venue_roles;
DROP POLICY IF EXISTS uvr_delete ON user_venue_roles;

-- Step 3: Re-enable RLS
ALTER TABLE user_venue_roles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create SIMPLE policies (NO recursion!)

-- Users can see their OWN roles only
CREATE POLICY uvr_read ON user_venue_roles FOR SELECT
USING (user_id = auth.uid());

-- Block all writes (service role bypasses RLS)
CREATE POLICY uvr_insert ON user_venue_roles FOR INSERT
WITH CHECK (false);

CREATE POLICY uvr_update ON user_venue_roles FOR UPDATE
USING (false);

CREATE POLICY uvr_delete ON user_venue_roles FOR DELETE
USING (false);

-- Step 5: Make sure you have owner role for cafe-nur
-- Replace YOUR_USER_ID with your actual user ID from auth.users
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the first user (change this if you have multiple users)
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    -- Add owner role for cafe-nur (or whatever your venue_id is)
    INSERT INTO user_venue_roles (venue_id, user_id, role)
    VALUES ('cafe-nur', v_user_id, 'owner')
    ON CONFLICT (venue_id, user_id) 
    DO UPDATE SET role = 'owner';
    
    RAISE NOTICE 'Added owner role for user % to cafe-nur', v_user_id;
  END IF;
END $$;

-- Step 6: Verify
SELECT 
  uvr.venue_id,
  uvr.user_id,
  uvr.role,
  u.email
FROM user_venue_roles uvr
JOIN auth.users u ON u.id = uvr.user_id;

