-- Add soft delete support to feedback_questions table
ALTER TABLE public.feedback_questions 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Create index for better performance when filtering deleted questions
CREATE INDEX IF NOT EXISTS idx_feedback_questions_deleted 
ON public.feedback_questions (venue_id, is_deleted);

-- Update RLS policy to include is_deleted check
DROP POLICY IF EXISTS "owner can select questions" ON public.feedback_questions;
CREATE POLICY "owner can select questions" ON public.feedback_questions
  FOR SELECT USING (
    (is_deleted IS NULL OR is_deleted = false) AND
    exists(select 1 from public.venues v where v.venue_id = feedback_questions.venue_id and v.owner_id = auth.uid())
  );
