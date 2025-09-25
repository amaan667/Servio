"use client";

import { useState, useEffect, useCallback } from 'react';
import { Star, Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import type { FeedbackQuestion, FeedbackAnswer } from '@/types/feedback';

interface UnifiedFeedbackFormProps {
  venueId: string;
  orderId?: string;
  customerName?: string;
  customerPhone?: string;
  onSubmit?: () => void;
}

export default function UnifiedFeedbackForm({ 
  venueId, 
  orderId, 
  customerName = 'Customer',
  customerPhone,
  onSubmit 
}: UnifiedFeedbackFormProps) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [answers, setAnswers] = useState<{[key: string]: any}>({});
  const { toast } = useToast();

  // Generic feedback questions (matching the screenshot layout)
  const genericQuestions: FeedbackQuestion[] = [
    {
      id: 'generic-overall-experience',
      venue_id: venueId,
      prompt: 'How would you rate your overall experience?',
      type: 'stars',
      choices: null,
      is_active: true,
      sort_index: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'generic-food-quality',
      venue_id: venueId,
      prompt: 'How was the food quality?',
      type: 'stars',
      choices: null,
      is_active: true,
      sort_index: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'generic-service',
      venue_id: venueId,
      prompt: 'How was the service?',
      type: 'stars',
      choices: null,
      is_active: true,
      sort_index: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'generic-recommendation',
      venue_id: venueId,
      prompt: 'Would you recommend us to others?',
      type: 'multiple_choice',
      choices: [
        'Yes, definitely',
        'Yes, probably',
        'Maybe',
        'No, probably not',
        'No, definitely not'
      ],
      is_active: true,
      sort_index: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'generic-comments',
      venue_id: venueId,
      prompt: 'Any additional comments or suggestions?',
      type: 'paragraph',
      choices: null,
      is_active: true,
      sort_index: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  // Fetch owner-created questions
  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/feedback/questions/public?venueId=${venueId}`);
      
      if (response.ok) {
        const data = await response.json();
        const ownerQuestions = data.questions || [];
        
        if (ownerQuestions.length > 0) {
          setQuestions(ownerQuestions);
        } else {
          setQuestions(genericQuestions);
        }
      } else {
        setQuestions(genericQuestions);
      }
    } catch (error) {
      console.error('[FEEDBACK] Error fetching questions:', error);
      setQuestions(genericQuestions);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleAnswerChange = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (questions.length === 0) return;

    setSubmitting(true);

    try {
      const feedbackAnswers: FeedbackAnswer[] = questions.map(question => {
        const answer = answers[question.id];
        
        switch (question.type) {
          case 'stars':
            return {
              question_id: question.id,
              type: 'stars' as const,
              answer_stars: answer || 0,
              order_id: orderId
            };
          case 'multiple_choice':
            return {
              question_id: question.id,
              type: 'multiple_choice' as const,
              answer_choice: answer || '',
              order_id: orderId
            };
          case 'paragraph':
            return {
              question_id: question.id,
              type: 'paragraph' as const,
              answer_text: answer || '',
              order_id: orderId
            };
          default:
            throw new Error('Invalid question type');
        }
      }).filter(answer => {
        // Filter out empty answers
        switch (answer.type) {
          case 'stars':
            return answer.answer_stars > 0;
          case 'multiple_choice':
            return answer.answer_choice.trim() !== '';
          case 'paragraph':
            return answer.answer_text.trim() !== '';
          default:
            return false;
        }
      });

      if (feedbackAnswers.length === 0) {
        toast({
          title: "No Feedback",
          description: "Please answer at least one question",
          variant: "destructive"
        });
        return;
      }

      // Submit feedback
      const response = await fetch('/api/feedback-responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venue_id: venueId,
          order_id: orderId,
          answers: feedbackAnswers
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      setIsSubmitted(true);
      toast({
        title: "Thank you!",
        description: "Your feedback has been submitted successfully.",
      });

      if (onSubmit) {
        onSubmit();
      }

    } catch (error) {
      console.error('[FEEDBACK] Error submitting feedback:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to submit feedback. Please try again.',
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ 
    value, 
    onChange, 
    label 
  }: { 
    value: number; 
    onChange: (rating: number) => void; 
    label: string; 
  }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none"
          >
            <Star
              className={`h-6 w-6 ${
                star <= value
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading feedback form...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Thank you!</h3>
          <p className="text-gray-600">Your feedback has been submitted successfully.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-lg text-center">We'd love your feedback!</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((question) => (
            <div key={question.id} className="space-y-3">
              {question.type === 'stars' && (
                <StarRating
                  value={answers[question.id] || 0}
                  onChange={(rating) => handleAnswerChange(question.id, rating)}
                  label={question.prompt}
                />
              )}

              {question.type === 'multiple_choice' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    {question.prompt}
                  </Label>
                  <RadioGroup
                    value={answers[question.id] || ''}
                    onValueChange={(value) => handleAnswerChange(question.id, value)}
                  >
                    {question.choices?.map((choice, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <RadioGroupItem value={choice} id={`${question.id}-${index}`} />
                        <Label htmlFor={`${question.id}-${index}`} className="text-sm text-gray-700">
                          {choice}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {question.type === 'paragraph' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    {question.prompt}
                  </Label>
                  <Textarea
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Share your thoughts..."
                    rows={3}
                    maxLength={600}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500">
                    {(answers[question.id] || '').length}/600 characters
                  </p>
                </div>
              )}
            </div>
          ))}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
