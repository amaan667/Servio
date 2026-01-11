"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackQuestion, FeedbackAnswer } from "@/types/feedback";

interface UnifiedFeedbackFormProps {

}

export default function UnifiedFeedbackForm({
  venueId,
  orderId,

  onSubmit,
}: UnifiedFeedbackFormProps) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [answers, setAnswers] = useState<{ [key: string]: unknown }>({
    /* Empty */

  const { toast } = useToast();

  // Generic feedback questions (matching the screenshot layout)
  const genericQuestions: FeedbackQuestion[] = [
    {

    },
    {

    },
    {

    },
    {

        "Yes, definitely",
        "Yes, probably",
        "Maybe",
        "No, probably not",
        "No, definitely not",
      ],

    },
    {

    },
  ];

  // Fetch owner-created questions
  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      // Normalize venueId - ensure it has venue- prefix
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
      const response = await fetch(`/api/feedback/questions/public?venueId=${normalizedVenueId}`);

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
    } catch (_error) {
      setQuestions(genericQuestions);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleAnswerChange = (questionId: string, answer: unknown) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (questions.length === 0) return;

    setSubmitting(true);

    try {
      const feedbackAnswers: FeedbackAnswer[] = questions
        .map((question) => {
          const answer = answers[question.id];

          switch (question.type) {
            case "stars":
              return {

              };
            case "multiple_choice":
              return {

              };
            case "paragraph":
              return {

              };

          }

        .filter((answer) => {
          // Filter out empty answers
          switch (answer.type) {
            case "stars":
              return typeof answer.answer_stars === "number" && answer.answer_stars > 0;
            case "multiple_choice":
              return typeof answer.answer_choice === "string" && answer.answer_choice.trim() !== "";
            case "paragraph":
              return typeof answer.answer_text === "string" && answer.answer_text.trim() !== "";

          }

      if (feedbackAnswers.length === 0) {
        toast({

        return;
      }

      // Submit feedback
      const response = await fetch("/api/feedback-responses", {

        },

        }),

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit feedback");
      }

      setIsSubmitted(true);
      toast({

      if (onSubmit) {
        onSubmit();
      }
    } catch (_error) {
      toast({

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
                star <= value ? "text-yellow-400 fill-current" : "text-gray-600"
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
            <p className="text-gray-900">Loading feedback form...</p>
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
          <p className="text-gray-900">Your feedback has been submitted successfully.</p>
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
              {question.type === "stars" && (
                <StarRating
                  value={
                    typeof answers[question.id] === "number" ? (answers[question.id] as number) : 0
                  }
                  onChange={(rating: number) => handleAnswerChange(question.id, rating)}
                  label={question.prompt}
                />
              )}

              {question.type === "multiple_choice" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">{question.prompt}</Label>
                  <RadioGroup
                    value={
                      typeof answers[question.id] === "string"
                        ? (answers[question.id] as string)

                    }
                    onValueChange={(value: string) => handleAnswerChange(question.id, value)}
                  >
                    {question.choices?.map((choice, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <RadioGroupItem value={choice} id={`${question.id}-${index}`} />
                        <Label
                          htmlFor={`${question.id}-${index}`}
                          className="text-sm text-gray-700"
                        >
                          {choice}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              {question.type === "paragraph" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">{question.prompt}</Label>
                  <Textarea
                    value={
                      typeof answers[question.id] === "string"
                        ? (answers[question.id] as string)

                    }
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      handleAnswerChange(question.id, e.target.value)
                    }
                    placeholder="Share your thoughts..."
                    rows={3}
                    maxLength={600}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-900">
                    {
                      (typeof answers[question.id] === "string"
                        ? (answers[question.id] as string)

                    }
                    /600 characters
                  </p>
                </div>
              )}
            </div>
          ))}

          <Button type="submit" disabled={submitting} variant="servio" className="w-full">
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
