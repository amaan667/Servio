import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

export interface FeedbackQuestion {
  id: string;
  prompt: string;
  type: "stars" | "paragraph" | "multiple_choice";
  choices?: string[];
  is_active: boolean;
  sort_index: number;
}

export interface FeedbackResponse {
  question_id: string;
  type: string;
  answer_stars?: number;
  answer_text?: string;
  answer_choice?: string;
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
        console.error("[useFeedbackManagement] Error fetching questions:", _err);
      }
    };

    if (venueId) {
      fetchFeedbackQuestions();
    }
  }, [venueId]);

  const submitFeedback = async (orderId: string) => {
    if (feedbackResponses.length === 0) {
      toast({
        title: "No Feedback",
        description: "Please provide some feedback before submitting",
        variant: "destructive",
      });
      return;
    }

    setSubmittingFeedback(true);

    try {
      const supabase = await createClient();

      const { error } = await supabase.from("feedback_responses").insert(
        feedbackResponses.map((response) => ({
          order_id: orderId,
          venue_id: venueId,
          ...response,
        }))
      );

      if (error) throw error;

      toast({
        title: "Thank You!",
        description: "Your feedback has been submitted successfully",
      });

      setFeedbackResponses([]);
    } catch (_err) {
      toast({
        title: "Error",
        description: "Failed to submit feedback",
        variant: "destructive",
      });
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
    });
  };

  return {
    feedbackQuestions,
    feedbackResponses,
    submittingFeedback,
    submitFeedback,
    updateFeedbackResponse,
  };
}
