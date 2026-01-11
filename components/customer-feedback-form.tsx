"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageSquare, Send, CheckCircle } from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

interface CustomerFeedbackFormProps {
  venueId: string;
  orderId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  onFeedbackSubmitted?: () => void;
}

const FEEDBACK_CATEGORIES = [
  "Food Quality",
  "Service Speed",
  "Staff Friendliness",
  "Value for Money",
  "Ambiance",
  "Menu Variety",
  "Cleanliness",
  "Overall Experience",
];

export function CustomerFeedbackForm({
  venueId,
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  onFeedbackSubmitted,
}: CustomerFeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
  };

  const handleRatingHover = (hoverRating: number) => {
    setHoveredRating(hoverRating);
  };

  const handleRatingLeave = () => {
    setHoveredRating(0);
  };

  const getRatingLabel = (rating: number) => {
    switch (rating) {
      case 1:
        return "Poor";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Very Good";
      case 5:
        return "Excellent";
      default:
        return "Rate your experience";
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    if (rating >= 1) return "text-red-600";
    return "text-gray-700";
  };

  const submitFeedback = async () => {
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    if (!comment.trim()) {
      setError("Please provide a comment");
      return;
    }

    if (!selectedCategory) {
      setError("Please select a category");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Service unavailable");

      // Calculate sentiment score based on rating
      let sentimentLabel: "positive" | "negative" | "neutral";
      let sentimentScore: number;

      if (rating >= 4) {
        sentimentLabel = "positive";
        sentimentScore = 0.8 + (rating - 4) * 0.1;
      } else if (rating <= 2) {
        sentimentLabel = "negative";
        sentimentScore = 0.2 - (2 - rating) * 0.1;
      } else {
        sentimentLabel = "neutral";
        sentimentScore = 0.5;
      }

      const { error: insertError } = await supabase.from("feedback").insert({
        venue_id: venueId,
        order_id: orderId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        rating: rating,
        comment: comment.trim(),
        category: selectedCategory,
        sentiment_score: sentimentScore,
        sentiment_label: sentimentLabel,
      });

      if (insertError) throw new Error(insertError.message);

      setIsSubmitted(true);
      onFeedbackSubmitted?.();
    } catch (_err) {
      setError(
        _err instanceof Error ? _err.message : "Failed to submit feedback. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Thank You!</h3>
          <p className="text-gray-900 mb-4">
            Your feedback has been submitted successfully. We appreciate you taking the time to
            share your experience.
          </p>
          <div className="flex items-center justify-center space-x-1 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${
                  star <= rating ? "text-yellow-500 fill-current" : "text-gray-700"
                }`}
              />
            ))}
            <span className="ml-2 text-sm text-gray-900">({rating})</span>
          </div>
          <p className="text-sm text-gray-900">
            Your rating helps us improve our service for everyone.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-500" />
          Share Your Experience
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rating Section */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">
            How would you rate your experience? *
          </label>
          <div className="flex items-center justify-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleRatingChange(star)}
                onMouseEnter={() => handleRatingHover(star)}
                onMouseLeave={handleRatingLeave}
                className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-1"
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
                    star <= (hoveredRating || rating)
                      ? "text-yellow-500 fill-current"
                      : "text-gray-700"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className={`text-center text-sm font-medium ${getRatingColor(rating)}`}>
            {getRatingLabel(hoveredRating || rating)}
          </p>
        </div>

        {/* Category Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">
            What aspect would you like to comment on? *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`p-2 text-sm border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  selectedCategory === category
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Comment Section */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">
            Tell us more about your experience *
          </label>
          <Textarea
            placeholder="Share your thoughts, suggestions, or unknown specific feedback..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="resize-none"
            maxLength={500}
          />
          <div className="flex justify-between text-xs text-gray-900">
            <span>Your feedback helps us improve</span>
            <span>{comment.length}/500</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          onClick={submitFeedback}
          disabled={isSubmitting || rating === 0 || !comment.trim() || !selectedCategory}
          variant="servio"
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-servio-purple mr-2"></div>
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Submit Feedback
            </>
          )}
        </Button>

        {/* Optional Note */}
        <p className="text-xs text-gray-900 text-center">
          * Required fields. Your feedback is anonymous and helps us improve our service.
        </p>
      </CardContent>
    </Card>
  );
}
