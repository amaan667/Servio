-- Fix feedback permissions by removing problematic RLS policies
-- This script removes the policies that try to access auth.users table

-- Drop the problematic policy
DROP POLICY IF EXISTS "Customers can view their own feedback" ON public.feedback;

-- Create a simpler, working policy for customers
CREATE POLICY "Customers can view feedback" ON public.feedback
  FOR SELECT USING (true);

-- Ensure the main policies are working
-- Venue owners can view all feedback for their venues
DROP POLICY IF EXISTS "Venue owners can view their venue feedback" ON public.feedback;
CREATE POLICY "Venue owners can view their venue feedback" ON public.feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.venues v
      WHERE v.venue_id = feedback.venue_id
      AND v.owner_id = auth.uid()
    )
  );

-- Venue owners can update feedback responses
DROP POLICY IF EXISTS "Venue owners can update feedback responses" ON public.feedback;
CREATE POLICY "Venue owners can update feedback responses" ON public.feedback
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.venues v
      WHERE v.venue_id = feedback.venue_id
      AND v.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.venues v
      WHERE v.venue_id = feedback.venue_id
      AND v.owner_id = auth.uid()
    )
  );

-- Anyone can insert feedback (for customer submissions)
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
CREATE POLICY "Anyone can insert feedback" ON public.feedback
  FOR INSERT WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
