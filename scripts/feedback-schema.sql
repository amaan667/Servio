-- =====================================================
-- FEEDBACK SYSTEM DATABASE SCHEMA
-- =====================================================
-- This file creates the feedback table and related structures
-- for the customer feedback system.

-- =====================================================
-- FEEDBACK TABLE
-- =====================================================
-- Stores customer feedback and ratings
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES public.venues(venue_id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  category TEXT,
  sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= 0 AND sentiment_score <= 1),
  sentiment_label TEXT CHECK (sentiment_label IN ('positive', 'negative', 'neutral')),
  response TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
-- Index for venue-based queries
CREATE INDEX IF NOT EXISTS idx_feedback_venue_id ON public.feedback(venue_id);

-- Index for order-based queries
CREATE INDEX IF NOT EXISTS idx_feedback_order_id ON public.feedback(order_id);

-- Index for rating-based queries
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON public.feedback(rating);

-- Index for sentiment-based queries
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON public.feedback(sentiment_label);

-- Index for category-based queries
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback(category);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at);

-- Index for response status
CREATE INDEX IF NOT EXISTS idx_feedback_has_response ON public.feedback((response IS NOT NULL));

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
-- Enable RLS on the feedback table
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Venue owners can view all feedback for their venues
CREATE POLICY "Venue owners can view their venue feedback" ON public.feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.venues v
      WHERE v.venue_id = feedback.venue_id
      AND v.owner_id = auth.uid()
    )
  );

-- Policy: Venue owners can update feedback responses
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

-- Policy: Anyone can insert feedback (for customer submissions)
CREATE POLICY "Anyone can insert feedback" ON public.feedback
  FOR INSERT WITH CHECK (true);

-- Policy: Customers can view their own feedback (optional)
CREATE POLICY "Customers can view their own feedback" ON public.feedback
  FOR SELECT USING (
    customer_phone = (
      SELECT phone FROM auth.users WHERE id = auth.uid()
    ) OR
    customer_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================
-- Function to calculate average rating for a venue
CREATE OR REPLACE FUNCTION get_venue_average_rating(venue_id_param TEXT)
RETURNS DECIMAL(3,2) AS $$
DECLARE
  avg_rating DECIMAL(3,2);
BEGIN
  SELECT AVG(rating) INTO avg_rating
  FROM public.feedback
  WHERE venue_id = venue_id_param;
  
  RETURN COALESCE(avg_rating, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get feedback statistics for a venue
CREATE OR REPLACE FUNCTION get_venue_feedback_stats(venue_id_param TEXT)
RETURNS TABLE(
  total_feedback BIGINT,
  average_rating DECIMAL(3,2),
  positive_count BIGINT,
  negative_count BIGINT,
  neutral_count BIGINT,
  response_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_feedback,
    AVG(rating) as average_rating,
    COUNT(*) FILTER (WHERE sentiment_label = 'positive')::BIGINT as positive_count,
    COUNT(*) FILTER (WHERE sentiment_label = 'negative')::BIGINT as negative_count,
    COUNT(*) FILTER (WHERE sentiment_label = 'neutral')::BIGINT as neutral_count,
    (COUNT(*) FILTER (WHERE response IS NOT NULL)::DECIMAL / COUNT(*)::DECIMAL * 100) as response_rate
  FROM public.feedback
  WHERE venue_id = venue_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SAMPLE DATA (OPTIONAL)
-- =====================================================
-- Uncomment the following lines to insert sample feedback data
/*
INSERT INTO public.feedback (
  venue_id, 
  customer_name, 
  rating, 
  comment, 
  category, 
  sentiment_label, 
  sentiment_score
) VALUES 
  ('demo-venue', 'John Smith', 5, 'Excellent food and service!', 'Food Quality', 'positive', 0.9),
  ('demo-venue', 'Sarah Johnson', 4, 'Great experience, will come back', 'Overall Experience', 'positive', 0.8),
  ('demo-venue', 'Mike Brown', 3, 'Food was good but service was slow', 'Service Speed', 'neutral', 0.5),
  ('demo-venue', 'Lisa Davis', 2, 'Disappointed with the portion size', 'Value for Money', 'negative', 0.3),
  ('demo-venue', 'David Wilson', 5, 'Amazing atmosphere and delicious food!', 'Ambiance', 'positive', 0.9);
*/

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.feedback IS 'Stores customer feedback and ratings for venues';
COMMENT ON COLUMN public.feedback.sentiment_score IS 'AI-calculated sentiment score (0-1, where 1 is most positive)';
COMMENT ON COLUMN public.feedback.sentiment_label IS 'Categorized sentiment: positive, negative, or neutral';
COMMENT ON COLUMN public.feedback.response IS 'Venue owner response to customer feedback';
COMMENT ON COLUMN public.feedback.responded_at IS 'Timestamp when venue owner responded to feedback';
