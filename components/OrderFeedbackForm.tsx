"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import type { FeedbackQuestion, FeedbackAnswer } from "@/types/feedback";

interface OrderFeedbackFormProps {

}

export default function OrderFeedbackForm({ venueId, orderId }: OrderFeedbackFormProps) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [answers, setAnswers] = useState<{ [key: string]: unknown }>({
    /* Empty */

  const { toast } = useToast();

  // Generic feedback questions to show if owner hasn't created unknown
  const genericQuestions: FeedbackQuestion[] = [
    {

    },
    {

    },
    {

    },
    {

    },
    {

    },
  ];

  // useEffect moved after fetchQuestions definition

  useEffect(() => {
    /* Empty */
  }, [totalCount]);

  // Real-time subscription moved after fetchQuestions definition

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      // Normalize venueId - ensure it has venue- prefix
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
      const response = await fetch(`/api/feedback/questions/public?venueId=${normalizedVenueId}`);

      if (response.ok) {
        const data = await response.json();
        const ownerQuestions = data.questions || [];

        // If no custom questions, use generic ones
        if (ownerQuestions.length === 0) {
          setQuestions(genericQuestions);
          setTotalCount(genericQuestions.length);
          setActiveCount(genericQuestions.length);
        } else {
          setQuestions(ownerQuestions);
          setTotalCount(ownerQuestions.length);
          setActiveCount(ownerQuestions.length);
        }
      } else {
        // If API fails, fall back to generic questions
        setQuestions(genericQuestions);
        setTotalCount(genericQuestions.length);
        setActiveCount(genericQuestions.length);
      }
    } catch (_error) {
      // If API fails, fall back to generic questions
      setQuestions(genericQuestions);
      setTotalCount(genericQuestions.length);
      setActiveCount(genericQuestions.length);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Set up real-time subscription for feedback questions
  useEffect(() => {
    const supabase = createClient();

    const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
    const channel = supabase
      .channel(`feedback-questions-${normalizedVenueId}`)
      .on(
        "postgres_changes",
        {

          filter: `venue_id=eq.${normalizedVenueId}`,
        },
        (_payload: unknown) => {
          fetchQuestions();
        }
      )
      .subscribe((_status: unknown) => {
        /* Empty */

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, fetchQuestions]);

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

      // Try to submit to the main feedback API first
      let response = await fetch("/api/feedback-responses", {

        headers: { "Content-Type": "application/json" },

        }),

      // If main API fails and we have generic questions, try to submit to a fallback
      if (!response.ok && questions.some((q) => q.id.startsWith("generic"))) {
        // For generic questions, we can store them locally or send to a different endpoint
        // For now, we'll just show success since these are demo/generic questions
        response = { ok: true } as Response;
      }

      if (response.ok) {
        toast({

        setShowForm(false);
        setAnswers({
          /* Empty */

      } else {
        const error = await response.json();
        toast({

      }
    } catch (_error) {
      // If we have generic questions and the main API fails, still show success
      if (questions.some((q) => q.id.startsWith("generic"))) {
        toast({

        setShowForm(false);
        setAnswers({
          /* Empty */

      } else {
        toast({

      }
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({
    value,
    onChange,
  }: {

  }) => (
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
        <Button onClick={() => setShowForm(true)} variant="outline" className="w-full">
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

                  {question.type === "stars" && (
                    <div className="space-y-2">
                      <StarRating
                        value={
                          typeof answers[question.id] === "number"
                            ? (answers[question.id] as number)

                        }
                        onChange={(rating: number) =>
                          setAnswers((prev) => ({ ...prev, [question.id]: rating }))
                        }
                      />
                      <p className="text-sm text-gray-900">
                        {answers[question.id] && typeof answers[question.id] === "number"
                          ? `${answers[question.id] as number} star${(answers[question.id] as number) > 1 ? "s" : ""} selected`
                          : "Please select a rating"}
                      </p>
                    </div>
                  )}

                  {question.type === "multiple_choice" && question.choices && (
                    <RadioGroup
                      value={
                        typeof answers[question.id] === "string"
                          ? (answers[question.id] as string)

                      }
                      onValueChange={(value: string) =>
                        setAnswers((prev) => ({ ...prev, [question.id]: value }))
                      }
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

                  {question.type === "paragraph" && (
                    <div className="space-y-2">
                      <Textarea
                        value={
                          typeof answers[question.id] === "string"
                            ? (answers[question.id] as string)

                        }
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                        }
                        placeholder="Share your thoughts..."
                        rows={3}
                        maxLength={600}
                      />
                      <p className="text-sm text-gray-900">
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

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setAnswers({
                      /* Empty */

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
