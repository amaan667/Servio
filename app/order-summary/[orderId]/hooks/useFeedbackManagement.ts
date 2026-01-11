import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

export interface FeedbackQuestion {

}

export interface FeedbackResponse {

}

export function useFeedbackManagement(venueId: string) {
  const [feedbackQuestions, setFeedbackQuestions] = useState<FeedbackQuestion[]>([]);
  const [feedbackResponses, setFeedbackResponses] = useState<FeedbackResponse[]>([]);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    const fetchFeedbackQuestions = async () => {
      try {
        // Normalize venueId - ensure it has venue- prefix
        const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

        // Use public API endpoint to get properly mapped questions
        const response = await fetch(`/api/feedback/questions/public?venueId=${normalizedVenueId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch questions: ${response.statusText}`);
        }

        const data = await response.json();
        const questions = (data.questions || []) as FeedbackQuestion[];

        setFeedbackQuestions(questions);
      } catch (_err) {
        // Error silently handled - questions will remain empty
      }
    };

    if (venueId) {
      fetchFeedbackQuestions();
    }
  }, [venueId]);

  const submitFeedback = async (orderId: string) => {
    if (feedbackResponses.length === 0) {
      toast({

      return;
    }

    setSubmittingFeedback(true);

    try {
      const supabase = await createClient();

      const { error } = await supabase.from("feedback_responses").insert(
        feedbackResponses.map((response) => ({

          ...response,
        }))
      );

      if (error) throw error;

      toast({

      setFeedbackResponses([]);
    } catch (_err) {
      toast({

    } finally {
      setSubmittingFeedback(false);
    }
  };

  const updateFeedbackResponse = (questionId: string, response: Partial<FeedbackResponse>) => {
    setFeedbackResponses((prev) => {
      const existing = prev.find((r) => r.question_id === questionId);
      if (existing) {
        return prev.map((r) => (r.question_id === questionId ? { ...r, ...response } : r));
      }
      return [...prev, { question_id: questionId, type: "", ...response }];

  };

  return {
    feedbackQuestions,
    feedbackResponses,
    submittingFeedback,
    submitFeedback,
    updateFeedbackResponse,
  };
}
