-- =====================================================
-- CONSOLIDATE FEEDBACK TABLES
-- =====================================================
-- This script consolidates all feedback data into the main 'feedback' table
-- and removes redundant tables

-- =====================================================
-- STEP 1: MIGRATE DATA FROM FEEDBACK_RESPONSES TO FEEDBACK
-- =====================================================

-- First, let's see what data exists in feedback_responses
-- We'll aggregate responses by order_id and create feedback entries

INSERT INTO public.feedback (
  venue_id,
  order_id,
  customer_name,
  customer_email,
  customer_phone,
  rating,
  comment,
  category,
  created_at,
  updated_at
)
SELECT 
  fr.venue_id,
  fr.order_id,
  COALESCE(fr.customer_name, 'Customer') as customer_name,
  NULL as customer_email,
  NULL as customer_phone,
  -- Calculate average rating from star responses
  CASE 
    WHEN COUNT(CASE WHEN fq.type = 'stars' AND fr.answer_stars IS NOT NULL THEN fr.answer_stars END) > 0
    THEN ROUND(AVG(CASE WHEN fq.type = 'stars' AND fr.answer_stars IS NOT NULL THEN fr.answer_stars END))
    ELSE 3 -- Default rating if no star responses
  END as rating,
  -- Combine all text responses into comment
  STRING_AGG(
    CASE 
      WHEN fq.type = 'paragraph' AND fr.answer_text IS NOT NULL AND fr.answer_text != ''
      THEN fq.prompt || ': ' || fr.answer_text
      WHEN fq.type = 'multiple_choice' AND fr.answer_choice IS NOT NULL
      THEN fq.prompt || ': ' || fr.answer_choice
      ELSE NULL
    END, 
    E'\n\n'
  ) as comment,
  'structured' as category,
  MIN(fr.created_at) as created_at,
  MAX(fr.created_at) as updated_at
FROM public.feedback_responses fr
JOIN public.feedback_questions fq ON fr.question_id = fq.id
WHERE fr.order_id IS NOT NULL
GROUP BY fr.venue_id, fr.order_id, fr.customer_name
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 2: MIGRATE DATA FROM ORDER_FEEDBACK TO FEEDBACK
-- =====================================================

INSERT INTO public.feedback (
  venue_id,
  order_id,
  customer_name,
  customer_email,
  customer_phone,
  rating,
  comment,
  category,
  created_at,
  updated_at
)
SELECT 
  o.venue_id,
  of.order_id,
  'Customer' as customer_name,
  NULL as customer_email,
  NULL as customer_phone,
  of.rating,
  of.comment,
  'order' as category,
  of.created_at,
  of.created_at as updated_at
FROM public.order_feedback of
JOIN public.orders o ON of.order_id = o.id
ON CONFLICT DO NOTHING;

-- =====================================================
-- STEP 3: DROP REDUNDANT TABLES
-- =====================================================

-- Drop the feedback_responses table
DROP TABLE IF EXISTS public.feedback_responses CASCADE;

-- Drop the order_feedback table
DROP TABLE IF EXISTS public.order_feedback CASCADE;

-- Keep feedback_questions table as it's needed for the question management system

-- =====================================================
-- STEP 4: UPDATE FEEDBACK TABLE SCHEMA (if needed)
-- =====================================================

-- Add any missing columns to the feedback table
ALTER TABLE public.feedback 
ADD COLUMN IF NOT EXISTS feedback_type TEXT DEFAULT 'general' CHECK (feedback_type IN ('general', 'structured', 'order'));

-- Update existing records to have proper feedback_type
UPDATE public.feedback 
SET feedback_type = 'structured' 
WHERE category = 'structured';

UPDATE public.feedback 
SET feedback_type = 'order' 
WHERE category = 'order';

-- =====================================================
-- STEP 5: CLEAN UP INDEXES
-- =====================================================

-- Add index for feedback_type if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_feedback_type ON public.feedback(feedback_type);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check total feedback count
SELECT 'Total feedback entries' as description, COUNT(*) as count FROM public.feedback;

-- Check feedback by type
SELECT feedback_type, COUNT(*) as count FROM public.feedback GROUP BY feedback_type;

-- Check feedback by venue
SELECT venue_id, COUNT(*) as count FROM public.feedback GROUP BY venue_id ORDER BY count DESC;
