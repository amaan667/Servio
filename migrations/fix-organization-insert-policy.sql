-- Fix: Add INSERT policy for organizations table
-- This allows authenticated users to create their own organizations

-- Organizations: Authenticated users can create organizations for themselves
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Verification
DO $$ 
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Organization INSERT Policy Fix Applied!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Users can now create organizations when selecting a plan';
  RAISE NOTICE '=================================================================';
END $$;
