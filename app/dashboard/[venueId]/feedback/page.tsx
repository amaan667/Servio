"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, Send, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { venuePath } from '@/lib/path';
import FeedbackBuilderClient from './FeedbackBuilderClient';

interface FeedbackEntry {
  id: string;
  created_at: string;
  rating: number;
  comment: string | null;
  order_id: string;
}

export default function FeedbackPage({ params }: { params: { venueId: string } }) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [orderId, setOrderId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch existing feedback
  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    try {
      const response = await fetch('/api/feedback/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue_id: params.venueId })
      });

      if (response.ok) {
        const data = await response.json();
        setFeedbackList(data.feedback || []);
      } else {
        console.error('[AUTH DEBUG] Failed to fetch feedback');
      }
    } catch (err) {
      console.error('[AUTH DEBUG] Error fetching feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a rating before submitting.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId || null,
          rating,
          comment: comment.trim() || null
        })
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Feedback Submitted",
          description: "Thank you for your feedback!",
        });
        
        // Reset form
        setRating(0);
        setComment('');
        setOrderId('');
        
        // Refresh feedback list
        fetchFeedback();
      } else {
        setError(result.error || 'Failed to submit feedback');
        toast({
          title: "Error",
          description: result.error || 'Failed to submit feedback',
          variant: "destructive"
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange, readonly = false }: { 
    value: number; 
    onChange?: (rating: number) => void; 
    readonly?: boolean;
  }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
          className={`transition-colors ${
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          }`}
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Navigation */}
      <nav className="mb-6">
        <Link 
          href={venuePath(params.venueId)} 
          className="text-blue-600 hover:text-blue-800 transition-colors"
        >
          Home
        </Link>
        <span className="mx-2 text-gray-500">/</span>
        <span className="text-gray-900">Feedback</span>
      </nav>

      <h1 className="text-3xl font-bold mb-8">Feedback</h1>

      {/* Question Builder Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Feedback Questions</h2>
        <p className="text-gray-600 mb-6">
          Create custom feedback questions for your customers. These will appear on the order confirmation page.
        </p>
        <FeedbackBuilderClient venueId={params.venueId} />
      </div>

      {/* Feedback Submission Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Submit Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating */}
            <div className="space-y-2">
              <Label htmlFor="rating">Rating *</Label>
              <StarRating value={rating} onChange={setRating} />
              <p className="text-sm text-gray-500">
                {rating === 0 && "Please select a rating"}
                {rating > 0 && `${rating} star${rating > 1 ? 's' : ''} selected`}
              </p>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts about the service, food, or experience..."
                rows={4}
                maxLength={500}
              />
              <p className="text-sm text-gray-500">
                {comment.length}/500 characters
              </p>
            </div>

            {/* Order Reference */}
            <div className="space-y-2">
              <Label htmlFor="orderId">Order Reference (Optional)</Label>
              <Input
                id="orderId"
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Enter order ID or reference number"
              />
              <p className="text-sm text-gray-500">
                If this feedback is related to a specific order, please include the order reference
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={submitting || rating === 0}
              className="w-full"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Feedback List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No feedback submitted yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Be the first to share your experience!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbackList.map((feedback) => (
                <div key={feedback.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StarRating value={feedback.rating} readonly />
                      <span className="text-sm font-medium text-gray-700">
                        {feedback.rating}/5
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(feedback.created_at).toLocaleDateString('en-GB', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  
                  {feedback.comment && (
                    <p className="text-gray-700 leading-relaxed">
                      {feedback.comment}
                    </p>
                  )}
                  
                  {feedback.order_id && (
                    <div className="text-sm text-gray-500">
                      Order: {feedback.order_id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


