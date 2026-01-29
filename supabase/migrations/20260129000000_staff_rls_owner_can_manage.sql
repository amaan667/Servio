-- Fix staff table RLS so venue owners can insert/update/delete staff.
-- Run this in Supabase SQL Editor if the staff init route never applied the policy
-- (e.g. exec_sql RPC missing) or if the policy was created incorrectly.

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if present (avoids conflict or wrong definition)
DROP POLICY IF EXISTS "owner can manage staff" ON public.staff;

-- Owner of the venue can do everything on staff for that venue
CREATE POLICY "owner can manage staff"
  ON public.staff
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.venues v
      WHERE v.venue_id = staff.venue_id
        AND v.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venues v
      WHERE v.venue_id = staff.venue_id
        AND v.owner_user_id = auth.uid()
    )
  );
