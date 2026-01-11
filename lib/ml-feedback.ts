/**
 * ML Feedback Loop System
 * Learns from user corrections to improve AI matching accuracy
 */

import { createAdminClient } from "./supabase";

interface MatchCorrection {

  metadata?: Record<string, unknown>;
}

interface CategoryCorrection {

  metadata?: Record<string, unknown>;
}

/**
 * Record a match correction from user
 */
export async function recordMatchCorrection(correction: MatchCorrection) {
  try {
    const supabase = createAdminClient();

    const correctionType =
      correction.wasMatched === correction.shouldMatch
        ? "correct"

    const { error } = await supabase.from("match_corrections").insert({

      metadata: correction.metadata || {},

    if (error) {
      
      return false;
    }

    

    return true;
  } catch (error) {

    return false;
  }
}

/**
 * Record a category correction from user
 */
export async function recordCategoryCorrection(correction: CategoryCorrection) {
  try {
    const supabase = createAdminClient();

    const wasCorrect = correction.aiSuggestedCategory === correction.userAssignedCategory;

    const { error } = await supabase.from("category_corrections").insert({

      metadata: correction.metadata || {},

    if (error) {
      
      return false;
    }

    

    return true;
  } catch (error) {

    return false;
  }
}

/**
 * Get adaptive matching threshold based on historical corrections
 */
export async function getAdaptiveMatchingThreshold(

    const { data: falseNegatives } = await supabase
      .from("match_corrections")
      .select("similarity_score")
      .eq("venue_id", venueId)
      .eq("correction_type", "false_negative")
      .order("corrected_at", { ascending: false })
      .limit(50);

    if (!falseNegatives || falseNegatives.length < 5) {
      // Not enough data - use default
      return defaultThreshold;
    }

    // Calculate average similarity of false negatives
    const avgFalseNegativeScore =
      falseNegatives.reduce((sum, fn) => sum + (fn.similarity_score || 0), 0) /
      falseNegatives.length;

    // Adaptive threshold: slightly below the average false negative score
    // This ensures we don't miss similar items in the future
    const adaptiveThreshold = Math.max(0.3, Math.min(0.7, avgFalseNegativeScore * 0.9));

    

    return adaptiveThreshold;
  } catch (error) {

    return defaultThreshold;
  }
}

/**
 * Get AI accuracy metrics
 */
export async function getAIAccuracyMetrics(venueId?: string, days: number = 30) {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("get_ai_accuracy_rate", {

    if (error) {
      
      return null;
    }

    return data?.[0] || null;
  } catch (error) {

    return null;
  }
}

/**
 * Record AI performance metric
 */
export async function recordAIPerformanceMetric(

  metadata?: Record<string, unknown>
) {
  try {
    const supabase = createAdminClient();

    // Get or create today's metric
    const today = new Date().toISOString().split("T")[0];

    const { data: existing } = await supabase
      .from("ai_performance_metrics")
      .select("*")
      .eq("metric_type", metricType)
      .eq("metric_date", today)
      .single();

    if (existing) {
      // Update existing
      const totalAttempts = existing.total_attempts + 1;
      const successfulAttempts = existing.successful_attempts + (success ? 1 : 0);
      const failedAttempts = existing.failed_attempts + (success ? 0 : 1);
      const avgConfidence =
        (existing.avg_confidence * existing.total_attempts + confidence) / totalAttempts;
      const avgProcessingTime =
        (existing.avg_processing_time_ms * existing.total_attempts + processingTimeMs) /
        totalAttempts;

      await supabase
        .from("ai_performance_metrics")
        .update({

          metadata: { ...(existing.metadata || {}), ...(metadata || {}) },

        .eq("id", existing.id);
    } else {
      // Create new
      await supabase.from("ai_performance_metrics").insert({

        metadata: metadata || {},

    }

    return true;
  } catch (error) {

    return false;
  }
}
