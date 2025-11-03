-- ML Feedback Loop Tables
-- Stores user corrections to improve AI matching accuracy over time

-- Match corrections table
CREATE TABLE IF NOT EXISTS match_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  pdf_item_name TEXT NOT NULL,
  url_item_name TEXT NOT NULL,
  similarity_score DECIMAL(5,4), -- 0.0000 to 1.0000
  was_matched BOOLEAN NOT NULL, -- Did our algorithm match them?
  should_match BOOLEAN NOT NULL, -- Should they have been matched (user correction)?
  correction_type TEXT CHECK (correction_type IN ('false_positive', 'false_negative', 'correct')),
  corrected_by UUID REFERENCES auth.users(id),
  corrected_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB, -- Additional context (category, price difference, etc.)
  UNIQUE(venue_id, pdf_item_name, url_item_name)
);

-- Category corrections table
CREATE TABLE IF NOT EXISTS category_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  ai_suggested_category TEXT NOT NULL,
  user_assigned_category TEXT NOT NULL,
  confidence_score DECIMAL(5,4), -- AI's confidence
  was_correct BOOLEAN NOT NULL, -- Was AI correct?
  corrected_by UUID REFERENCES auth.users(id),
  corrected_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(venue_id, item_name, ai_suggested_category)
);

-- AI performance metrics table (aggregated stats)
CREATE TABLE IF NOT EXISTS ai_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('matching', 'categorization', 'extraction')),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_attempts INTEGER DEFAULT 0,
  successful_attempts INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  avg_confidence DECIMAL(5,4),
  avg_processing_time_ms INTEGER,
  metadata JSONB,
  UNIQUE(metric_type, metric_date)
);

-- Indexes for performance
CREATE INDEX idx_match_corrections_venue ON match_corrections(venue_id, corrected_at DESC);
CREATE INDEX idx_match_corrections_type ON match_corrections(correction_type);
CREATE INDEX idx_category_corrections_venue ON category_corrections(venue_id, corrected_at DESC);
CREATE INDEX idx_category_corrections_accuracy ON category_corrections(was_correct);
CREATE INDEX idx_ai_metrics_type_date ON ai_performance_metrics(metric_type, metric_date DESC);

-- Comments
COMMENT ON TABLE match_corrections IS 'User corrections for improving item matching AI accuracy';
COMMENT ON TABLE category_corrections IS 'User corrections for improving categorization AI accuracy';
COMMENT ON TABLE ai_performance_metrics IS 'Aggregated AI performance metrics for monitoring';

-- Function to get AI accuracy rate
CREATE OR REPLACE FUNCTION get_ai_accuracy_rate(
  p_venue_id TEXT DEFAULT NULL,
  p_metric_type TEXT DEFAULT 'matching',
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_corrections INTEGER,
  correct_predictions INTEGER,
  accuracy_rate DECIMAL
) AS $$
BEGIN
  IF p_metric_type = 'categorization' THEN
    RETURN QUERY
    SELECT 
      COUNT(*)::INTEGER AS total_corrections,
      COUNT(*) FILTER (WHERE was_correct = true)::INTEGER AS correct_predictions,
      ROUND(
        COUNT(*) FILTER (WHERE was_correct = true)::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 
        2
      ) AS accuracy_rate
    FROM category_corrections
    WHERE (p_venue_id IS NULL OR venue_id = p_venue_id)
      AND corrected_at >= NOW() - (p_days || ' days')::INTERVAL;
  ELSE
    RETURN QUERY
    SELECT 
      COUNT(*)::INTEGER AS total_corrections,
      COUNT(*) FILTER (WHERE correction_type = 'correct')::INTEGER AS correct_predictions,
      ROUND(
        COUNT(*) FILTER (WHERE correction_type = 'correct')::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 
        2
      ) AS accuracy_rate
    FROM match_corrections
    WHERE (p_venue_id IS NULL OR venue_id = p_venue_id)
      AND corrected_at >= NOW() - (p_days || ' days')::INTERVAL;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed)
-- ALTER TABLE match_corrections ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE category_corrections ENABLE ROW LEVEL SECURITY;

