"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Heart,
  AlertTriangle,
  BarChart3,
  MessageSquare,
  Plus,
} from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import QuestionsClient from "@/app/dashboard/[venueId]/feedback/QuestionsClient";

interface Feedback {
  id: string;
  venue_id: string;
  order_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  rating: number;
  comment: string;
  sentiment_score?: number;
  sentiment_label?: "positive" | "negative" | "neutral";
  category?: string;
  created_at: string;
  updated_at: string;
}

interface FeedbackQuestion {
  id: string;
  prompt: string;
  type: string;
  is_active: boolean;
}

interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  positiveSentiment: number;
  negativeSentiment: number;
  neutralSentiment: number;
  topCategories: Array<{ category: string; count: number; avgRating: number }>;
  ratingDistribution: Array<{ rating: number; count: number; percentage: number }>;
}

interface FeedbackSystemProps {
  venueId: string;
}

export function EnhancedFeedbackSystem({ venueId }: FeedbackSystemProps) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "feedback" | "create">("overview");
  const [filters, setFilters] = useState({
    rating: 0,
    sentiment: "all",
    category: "all",
    dateRange: "30d",
  });
  const [searchQuery, setSearchQuery] = useState("");

  const fetchQuestions = useCallback(async () => {
    try {
      const response = await fetch(`/api/feedback/questions?venueId=${venueId}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
      }
    } catch (_error) {
      // Error silently handled
    }
  }, [venueId]);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase client not available");

      let query = supabase
        .from("feedback")
        .select("*")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters.rating > 0) {
        query = query.eq("rating", filters.rating);
      }
      if (filters.sentiment !== "all") {
        query = query.eq("sentiment_label", filters.sentiment);
      }
      if (filters.category !== "all") {
        query = query.eq("category", filters.category);
      }

      // Apply date range
      const now = new Date();
      const startDate = new Date();
      switch (filters.dateRange) {
        case "7d":
          startDate.setDate(now.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(now.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(now.getDate() - 90);
          break;
        case "1y":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      query = query.gte("created_at", startDate.toISOString());

      const { data, error: fetchError } = await query;

      if (fetchError) throw new Error(fetchError.message);

      let filteredFeedback = data || [];

      // Apply search filter (only filter not handled by query)
      if (searchQuery.trim()) {
        filteredFeedback = filteredFeedback.filter(
          (f) =>
            f.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.category?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setFeedback(filteredFeedback);
      calculateStats(filteredFeedback);
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to submit feedback");
    } finally {
      setLoading(false);
    }
  }, [venueId, filters, searchQuery]);

  const calculateStats = useCallback((feedbackData: Feedback[]) => {
    if (!feedbackData.length) {
      setStats(null);
      return;
    }

    const totalFeedback = feedbackData.length;
    const averageRating = feedbackData.reduce((sum, f) => sum + f.rating, 0) / totalFeedback;

    const sentimentCounts = feedbackData.reduce(
      (acc, f) => {
        const sentiment = f.sentiment_label || "neutral";
        acc[sentiment] = (acc[sentiment] || 0) + 1;
        return acc;
      },
      {
        /* Empty */
      } as Record<string, number>
    );

    const positiveSentiment = sentimentCounts.positive || 0;
    const negativeSentiment = sentimentCounts.negative || 0;
    const neutralSentiment = sentimentCounts.neutral || 0;

    // Category analysis
    const categoryStats: Record<string, { count: number; totalRating: number }> = {
      /* Empty */
    };
    feedbackData.forEach((f) => {
      const category = f.category || "General";
      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, totalRating: 0 };
      }
      categoryStats[category].count++;
      categoryStats[category].totalRating += f.rating;
    });

    const topCategories = Object.entries(categoryStats)
      .map(([category, stats]) => ({
        category,
        count: stats.count,
        avgRating: stats.totalRating / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Rating distribution
    const ratingCounts: Record<number, number> = {
      /* Empty */
    };
    for (let i = 1; i <= 5; i++) {
      ratingCounts[i] = 0;
    }
    feedbackData.forEach((f) => {
      ratingCounts[f.rating] = (ratingCounts[f.rating] || 0) + 1;
    });

    const ratingDistribution = Object.entries(ratingCounts).map(([rating, count]) => ({
      rating: parseInt(rating),
      count,
      percentage: (count / totalFeedback) * 100,
    }));

    setStats({
      totalFeedback,
      averageRating,
      positiveSentiment,
      negativeSentiment,
      neutralSentiment,
      topCategories,
      ratingDistribution,
    });
  }, []);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-green-100 text-green-800";
      case "negative":
        return "bg-red-100 text-red-800";
      case "neutral":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <ThumbsUp className="h-3 w-3" />;
      case "negative":
        return <ThumbsDown className="h-3 w-3" />;
      case "neutral":
        return <Heart className="h-3 w-3" />;
      default:
        return <Heart className="h-3 w-3" />;
    }
  };

  useEffect(() => {
    fetchFeedback();
    fetchQuestions();
  }, [fetchFeedback, fetchQuestions]);

  // Add listener for when questions are updated from the Create tab
  useEffect(() => {
    const handleQuestionsUpdated = () => {
      fetchQuestions();
    };

    // Listen for custom event when questions are created/updated
    window.addEventListener("feedbackQuestionsUpdated", handleQuestionsUpdated);

    return () => {
      window.removeEventListener("feedbackQuestionsUpdated", handleQuestionsUpdated);
    };
  }, [fetchQuestions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-gray-900">Loading feedback...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-sm">
        <CardHeader className="pb-6">
          <CardTitle>Customer Feedback System</CardTitle>
          <CardDescription className="text-gray-700">
            Monitor customer satisfaction and respond to feedback
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "create" | "feedback" | "overview")}
          >
            <TabsList className="grid w-full grid-cols-3 gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="feedback">All Feedback</TabsTrigger>
              <TabsTrigger value="create">Create Questions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8 mt-6">
              {stats && (
                <>
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm text-gray-700 font-medium">Total Feedback</p>
                            <p className="text-2xl font-bold text-gray-900">
                              {stats.totalFeedback}
                            </p>
                          </div>
                          <MessageSquare className="h-8 w-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-sm text-gray-700 font-medium">Average Rating</p>
                            <div className="flex items-center">
                              <span className="text-2xl font-bold text-gray-900">
                                {stats.averageRating.toFixed(1)}
                              </span>
                              <Star className="h-5 w-5 text-yellow-500 ml-1" />
                            </div>
                          </div>
                          <BarChart3 className="h-8 w-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <p className="text-sm text-gray-700 font-medium">Sentiment</p>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="bg-green-100 text-green-800">
                                {stats.positiveSentiment}
                              </Badge>
                              <Badge variant="outline" className="bg-red-100 text-red-800">
                                {stats.negativeSentiment}
                              </Badge>
                            </div>
                          </div>
                          <Heart className="h-8 w-8 text-red-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Rating Distribution */}
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle>Rating Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.ratingDistribution.map(({ rating, count, percentage }) => (
                          <div key={rating} className="flex items-center space-x-3">
                            <div className="flex items-center w-16">
                              <span className="text-sm font-medium">{rating}</span>
                              <Star className="h-4 w-4 text-yellow-500 ml-1" />
                            </div>
                            <Progress value={percentage} className="flex-1 h-2" />
                            <span className="text-sm text-gray-900 w-16 text-right">
                              {count} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Categories */}
                  <Card className="shadow-sm">
                    <CardHeader>
                      <CardTitle>Top Feedback Categories</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.topCategories.map(({ category, count, avgRating }) => (
                          <div
                            key={category}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{category}</p>
                              <p className="text-sm text-gray-900">{count} feedback items</p>
                            </div>
                            <div className="flex items-center">
                              <span className="text-sm font-medium mr-2">
                                {avgRating.toFixed(1)}
                              </span>
                              <Star className="h-4 w-4 text-yellow-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Questions Section */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2" />
                    Current Feedback Questions
                  </CardTitle>
                  <CardDescription>
                    These are the questions customers see when leaving feedback
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {questions.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-gray-700 mx-auto mb-4" />
                      <p className="text-gray-900 mb-4">No custom questions created yet</p>
                      <p className="text-sm text-gray-900">
                        Customers will see generic questions until you create custom ones.
                      </p>
                      <Button onClick={() => setActiveTab("create")} className="mt-4">
                        Create Your First Question
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {questions.map((question, index) => (
                        <div
                          key={question.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <span className="text-sm font-medium text-gray-900">
                                #{index + 1}
                              </span>
                              <span className="font-medium">{question.prompt}</span>
                              <Badge variant={question.is_active ? "default" : "secondary"}>
                                {question.type}
                              </Badge>
                              {!question.is_active && <Badge variant="outline">Inactive</Badge>}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="pt-4 border-t">
                        <Button onClick={() => setActiveTab("create")} variant="outline">
                          <Plus className="h-4 w-4 mr-2" />
                          Add More Questions
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="feedback" className="space-y-6 mt-6">
              {/* Filters and Search */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search feedback..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={filters.rating}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, rating: parseInt(e.target.value) }))
                    }
                    className="border rounded px-3 py-2 text-sm h-11 min-w-[120px] bg-purple-600 text-white border-purple-600"
                  >
                    <option value={0}>All Ratings</option>
                    <option value={5}>5 Stars</option>
                    <option value={4}>4+ Stars</option>
                    <option value={3}>3+ Stars</option>
                    <option value={2}>2+ Stars</option>
                    <option value={1}>1+ Stars</option>
                  </select>
                  <select
                    value={filters.sentiment}
                    onChange={(e) => setFilters((prev) => ({ ...prev, sentiment: e.target.value }))}
                    className="border rounded px-3 py-2 text-sm h-11 min-w-[120px] bg-purple-600 text-white border-purple-600"
                  >
                    <option value="all">All Sentiments</option>
                    <option value="positive">Positive</option>
                    <option value="negative">Negative</option>
                    <option value="neutral">Neutral</option>
                  </select>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: e.target.value }))}
                    className="border rounded px-3 py-2 text-sm h-11 min-w-[120px] bg-purple-600 text-white border-purple-600"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="1y">Last year</option>
                  </select>
                </div>
              </div>

              {/* Feedback List */}
              <div className="space-y-6">
                {feedback.map((item) => (
                  <Card key={item.id} className="shadow-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="font-medium">{item.customer_name}</span>
                            <div className="flex items-center">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${
                                    star <= item.rating
                                      ? "text-yellow-500 fill-current"
                                      : "text-gray-900"
                                  }`}
                                />
                              ))}
                              <span className="ml-2 text-sm text-gray-900">({item.rating})</span>
                            </div>
                            <Badge className={getSentimentColor(item.sentiment_label || "neutral")}>
                              {getSentimentIcon(item.sentiment_label || "neutral")}
                              <span className="ml-1 capitalize">
                                {item.sentiment_label || "neutral"}
                              </span>
                            </Badge>
                            {item.category && <Badge variant="outline">{item.category}</Badge>}
                          </div>

                          <p className="text-gray-700 mb-2">{item.comment}</p>

                          <div className="flex items-center justify-between text-sm text-gray-900">
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {feedback.length === 0 && (
                  <div className="text-center py-8 text-gray-900">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-900" />
                    <p>No feedback found matching your criteria.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="create" className="space-y-6 mt-6">
              <QuestionsClient venueId={venueId} mode="embedded" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
