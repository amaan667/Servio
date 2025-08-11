-- =====================================================
-- VENUES RLS POLICIES FOR AUTHENTICATED USERS
-- =====================================================
-- These policies allow venue owners to manage their own venues

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Venues are viewable by everyone" ON venues;
DROP POLICY IF EXISTS "Users can insert their own venues" ON venues;
DROP POLICY IF EXISTS "Users can update their own venues" ON venues;
DROP POLICY IF EXISTS "Users can delete their own venues" ON venues;

-- Allow everyone to read venues (for public ordering)
CREATE POLICY "Venues are viewable by everyone" 
ON venues FOR SELECT 
USING (true);

-- Allow authenticated users to insert venues they own
CREATE POLICY "Users can insert their own venues" 
ON venues FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

-- Allow authenticated users to update their own venues
CREATE POLICY "Users can update their own venues" 
ON venues FOR UPDATE 
USING (auth.uid() = owner_id) 
WITH CHECK (auth.uid() = owner_id);

-- Allow authenticated users to delete their own venues
CREATE POLICY "Users can delete their own venues" 
ON venues FOR DELETE 
USING (auth.uid() = owner_id);

-- Verify RLS is enabled
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- For debugging: Show current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'venues';
