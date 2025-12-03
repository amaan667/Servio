import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

export interface FeedbackQuestion {
  id: string;
  prompt: string;
  type: 'stars' | 'paragraph' | 'multiple_choice';
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
        const supabase = await createClient();
        
        const { data, error } = await supabase
          .from('feedback_questions')
          .select('*')
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .order('sort_index', { ascending: true });

        if (error) throw error;

        // Transform questions to match frontend expectations (prompt, type, choices)
        const transformedQuestions = (data || []).map((q: {
          id: string;
          question_text: string;
          question_type: string;
          options: string[] | null;
          is_active: boolean;
          sort_index: number;
          created_at?: string;
          updated_at?: string;
          venue_id: string;
        }) => ({
          id: q.id,
          prompt: q.question_text, // Map 'question_text' to 'prompt'
          type: q.question_type as 'stars' | 'paragraph' | 'multiple_choice', // Map 'question_type' to 'type'
          choices: q.options || [], // Map 'options' to 'choices'
          is_active: q.is_active,
          sort_index: q.sort_index,
        }));

        setFeedbackQuestions(transformedQuestions);
      } catch (_err) {
      // Error silently handled
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
      
      const { error } = await supabase
        .from('feedback_responses')
        .insert(
          feedbackResponses.map(response => ({
            order_id: orderId,
            venue_id: venueId,
            ...response
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
    setFeedbackResponses(prev => {
      const existing = prev.find(r => r.question_id === questionId);
      if (existing) {
        return prev.map(r => r.question_id === questionId ? { ...r, ...response } : r);
      }
      return [...prev, { question_id: questionId, type: '', ...response }];
    });
  };

  return {
    feedbackQuestions,
    feedbackResponses,
    submittingFeedback,
    submitFeedback,
    updateFeedbackResponse
  };
}

