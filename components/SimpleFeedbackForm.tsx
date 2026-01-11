"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface SimpleFeedbackFormProps {

}

export default function SimpleFeedbackForm({

  onSubmit,
}: SimpleFeedbackFormProps) {
  const [ratings, setRatings] = useState({

  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRatingChange = (category: keyof typeof ratings, rating: number) => {
    setRatings((prev) => ({ ...prev, [category]: rating }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Remove artificial delay - submit immediately

      // Show success message
      alert("Thank you for your feedback!");

      // Call onSubmit callback if provided
      if (onSubmit) {
        onSubmit();
      }
    } catch (_error) {
      alert("Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({
    value,
    onChange,
    label,
  }: {

  }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
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
                star <= value ? "text-yellow-400 fill-current" : "text-gray-600"
              }`}
            />
          </button>
        ))}
      </div>
      {value > 0 && (
        <p className="text-sm text-gray-900">
          {value} star{value > 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">We'd love your feedback!</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <StarRating
            value={ratings.foodQuality}
            onChange={(rating) => handleRatingChange("foodQuality", rating)}
            label="How would you rate the food quality?"
          />

          <StarRating
            value={ratings.service}
            onChange={(rating) => handleRatingChange("service", rating)}
            label="How would you rate the service?"
          />

          <StarRating
            value={ratings.value}
            onChange={(rating) => handleRatingChange("value", rating)}
            label="How would you rate the value for money?"
          />

          <StarRating
            value={ratings.overall}
            onChange={(rating) => handleRatingChange("overall", rating)}
            label="How would you rate your overall experience?"
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Any additional comments or suggestions?
            </label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Share your thoughts..."
              rows={3}
              maxLength={600}
            />
            <p className="text-sm text-gray-900">{comments.length}/600 characters</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={submitting || Object.values(ratings).every((r) => r === 0)}
              className="flex-1"
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </Button>
            <Button type="button" variant="outline" onClick={onSubmit} disabled={submitting}>
              Skip
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
