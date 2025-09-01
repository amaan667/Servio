"use client";

import { useState, useEffect } from 'react';
import { Star, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { FeedbackQuestion, FeedbackAnswer } from '@/types/feedback';

interface OrderFeedbackFormProps {
  venueId: string;
  orderId?: string;
}

export default function OrderFeedbackForm({ venueId, orderId }: OrderFeedbackFormProps) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [answers, setAnswers] = useState<{[key: string]: any}>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchQuestions();
  }, [venueId]);

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`/api/feedback/questions?venueId=${venueId}`);
      if (response.ok) {
        const data = await response.json();
        const activeQuestions = (data.questions || []).filter((q: FeedbackQuestion) => q.is_active);
        setQuestions(activeQuestions);
        setTotalCount(data.totalCount || 0);
      }
    } catch (error) {
      console.error('[FEEDBACK] Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
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
              type: 'stars',
              answer_stars: answer || 0,
              order_id: orderId
            };
          case 'multiple_choice':
            return {
              question_id: question.id,
              type: 'multiple_choice',
              answer_choice: answer || '',
              order_id: orderId
            };
          case 'paragraph':
            return {
              question_id: question.id,
              type: 'paragraph',
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

      const response = await fetch('/api/feedback-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_id: venueId,
          order_id: orderId,
          answers: feedbackAnswers
        })
      });

      if (response.ok) {
        toast({
          title: "Thank You!",
          description: "Your feedback has been submitted successfully"
        });
        setShowForm(false);
        setAnswers({});
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to submit feedback",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange }: { value: number; onChange: (rating: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="transition-colors hover:scale-110"
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
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">We'd love your feedback!</h3>
      
      {!showForm ? (
        <Button 
          onClick={() => setShowForm(true)} 
          variant="outline" 
          className="w-full"
        >
          <Send className="h-4 w-4 mr-2" />
          Answer Feedback Questions ({totalCount})
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {questions.map((question, index) => (
                <div key={question.id} className="space-y-3">
                  <Label className="text-base font-medium">
                    {index + 1}. {question.prompt}
                  </Label>
                  
                  {question.type === 'stars' && (
                    <div className="space-y-2">
                      <StarRating
                        value={answers[question.id] || 0}
                        onChange={(rating) => setAnswers(prev => ({ ...prev, [question.id]: rating }))}
                      />
                      <p className="text-sm text-gray-500">
                        {answers[question.id] ? `${answers[question.id]} star${answers[question.id] > 1 ? 's' : ''} selected` : 'Please select a rating'}
                      </p>
                    </div>
                  )}
                  
                  {question.type === 'multiple_choice' && question.choices && (
                    <RadioGroup
                      value={answers[question.id] || ''}
                      onValueChange={(value) => setAnswers(prev => ({ ...prev, [question.id]: value }))}
                    >
                      {question.choices.map((choice, choiceIndex) => (
                        <div key={choiceIndex} className="flex items-center space-x-2">
                          <RadioGroupItem value={choice} id={`${question.id}-${choiceIndex}`} />
                          <Label htmlFor={`${question.id}-${choiceIndex}`} className="text-sm">
                            {choice}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                  
                  {question.type === 'paragraph' && (
                    <div className="space-y-2">
                      <Textarea
                        value={answers[question.id] || ''}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                        placeholder="Share your thoughts..."
                        rows={3}
                        maxLength={600}
                      />
                      <p className="text-sm text-gray-500">
                        {(answers[question.id] || '').length}/600 characters
                      </p>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="flex gap-3 pt-4">
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1"
                >
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => {
                    setShowForm(false);
                    setAnswers({});
                  }}
                  disabled={submitting}
                >
                  Skip
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
