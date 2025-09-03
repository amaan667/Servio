"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Star, 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  Filter,
  Search,
  ThumbsUp,
  ThumbsDown,
  Heart,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Send,
  RefreshCw,
  Edit3
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

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
  sentiment_label?: 'positive' | 'negative' | 'neutral';
  category?: string;
  response?: string;
  responded_at?: string;
  created_at: string;
  updated_at: string;
}

interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  positiveSentiment: number;
  negativeSentiment: number;
  neutralSentiment: number;
  responseRate: number;
  topCategories: Array<{ category: string; count: number; avgRating: number }>;
  ratingDistribution: Array<{ rating: number; count: number; percentage: number }>;
}

interface FeedbackSystemProps {
  venueId: string;
}

export function EnhancedFeedbackSystem({ venueId }: FeedbackSystemProps) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'feedback' | 'responses'>('overview');
  const [filters, setFilters] = useState({
    rating: 0,
    sentiment: 'all',
    category: 'all',
    dateRange: '30d'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showResponseForm, setShowResponseForm] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not available');

      let query = supabase
        .from('feedback')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.rating > 0) {
        query = query.eq('rating', filters.rating);
      }
      if (filters.sentiment !== 'all') {
        query = query.eq('sentiment_label', filters.sentiment);
      }
      if (filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      // Apply date range
      const now = new Date();
      let startDate = new Date();
      switch (filters.dateRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      query = query.gte('created_at', startDate.toISOString());

      const { data, error: fetchError } = await query;

      if (fetchError) throw new Error(fetchError.message);

      let filteredFeedback = data || [];

      // Apply search filter
      if (searchQuery.trim()) {
        filteredFeedback = filteredFeedback.filter(f => 
          f.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.category?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setFeedback(filteredFeedback);
      calculateStats(filteredFeedback);

    } catch (err: any) {
      logger.error('Failed to fetch feedback', { error: err.message, venueId });
      setError(err.message);
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
    
    const sentimentCounts = feedbackData.reduce((acc, f) => {
      const sentiment = f.sentiment_label || 'neutral';
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const positiveSentiment = sentimentCounts.positive || 0;
    const negativeSentiment = sentimentCounts.negative || 0;
    const neutralSentiment = sentimentCounts.neutral || 0;

    const respondedCount = feedbackData.filter(f => f.response).length;
    const responseRate = (respondedCount / totalFeedback) * 100;

    // Category analysis
    const categoryStats: Record<string, { count: number; totalRating: number }> = {};
    feedbackData.forEach(f => {
      const category = f.category || 'General';
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
        avgRating: stats.totalRating / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Rating distribution
    const ratingCounts: Record<number, number> = {};
    for (let i = 1; i <= 5; i++) {
      ratingCounts[i] = 0;
    }
    feedbackData.forEach(f => {
      ratingCounts[f.rating] = (ratingCounts[f.rating] || 0) + 1;
    });

    const ratingDistribution = Object.entries(ratingCounts).map(([rating, count]) => ({
      rating: parseInt(rating),
      count,
      percentage: (count / totalFeedback) * 100
    }));

    setStats({
      totalFeedback,
      averageRating,
      positiveSentiment,
      negativeSentiment,
      neutralSentiment,
      responseRate,
      topCategories,
      ratingDistribution
    });
  }, []);

  const addResponse = async (feedbackId: string) => {
    if (!responseText.trim()) return;

    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase client not available');

      const { error } = await supabase
        .from('feedback')
        .update({
          response: responseText.trim(),
          responded_at: new Date().toISOString()
        })
        .eq('id', feedbackId);

      if (error) throw new Error(error.message);

      logger.info('Feedback response added', { feedbackId, venueId });
      
      // Refresh feedback data
      fetchFeedback();
      setShowResponseForm(null);
      setResponseText('');

    } catch (err: any) {
      logger.error('Failed to add response', { error: err.message, feedbackId });
      setError(err.message);
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      case 'neutral': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return <ThumbsUp className="h-3 w-3" />;
      case 'negative': return <ThumbsDown className="h-3 w-3" />;
      case 'neutral': return <MessageSquare className="h-3 w-3" />;
      default: return <MessageSquare className="h-3 w-3" />;
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-600';
    if (rating >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading feedback...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Customer Feedback System</span>
            <Button variant="outline" size="sm" onClick={fetchFeedback}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Monitor customer satisfaction and respond to feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="feedback">All Feedback</TabsTrigger>
              <TabsTrigger value="responses">Responses</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {stats && (
                <>
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Total Feedback</p>
                            <p className="text-2xl font-bold">{stats.totalFeedback}</p>
                          </div>
                          <MessageSquare className="h-8 w-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Average Rating</p>
                            <div className="flex items-center">
                              <span className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</span>
                              <Star className="h-5 w-5 text-yellow-500 ml-1" />
                            </div>
                          </div>
                          <BarChart3 className="h-8 w-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Response Rate</p>
                            <p className="text-2xl font-bold">{stats.responseRate.toFixed(1)}%</p>
                          </div>
                          <CheckCircle className="h-8 w-8 text-purple-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Sentiment</p>
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
                  <Card>
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
                            <span className="text-sm text-gray-600 w-16 text-right">
                              {count} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Categories */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Feedback Categories</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.topCategories.map(({ category, count, avgRating }) => (
                          <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <p className="font-medium">{category}</p>
                              <p className="text-sm text-gray-600">{count} feedback items</p>
                            </div>
                            <div className="flex items-center">
                              <span className="text-sm font-medium mr-2">{avgRating.toFixed(1)}</span>
                              <Star className="h-4 w-4 text-yellow-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="feedback" className="space-y-4">
              {/* Filters and Search */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search feedback..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={filters.rating}
                    onChange={(e) => setFilters(prev => ({ ...prev, rating: parseInt(e.target.value) }))}
                    className="border rounded px-3 py-2 text-sm"
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
                    onChange={(e) => setFilters(prev => ({ ...prev, sentiment: e.target.value }))}
                    className="border rounded px-3 py-2 text-sm"
                  >
                    <option value="all">All Sentiments</option>
                    <option value="positive">Positive</option>
                    <option value="negative">Negative</option>
                    <option value="neutral">Neutral</option>
                  </select>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                    className="border rounded px-3 py-2 text-sm"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="1y">Last year</option>
                  </select>
                </div>
              </div>

              {/* Feedback List */}
              <div className="space-y-4">
                {feedback.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="font-medium">{item.customer_name}</span>
                            <div className="flex items-center">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${
                                    star <= item.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'
                                  }`}
                                />
                              ))}
                              <span className="ml-2 text-sm text-gray-600">({item.rating})</span>
                            </div>
                            <Badge className={getSentimentColor(item.sentiment_label || 'neutral')}>
                              {getSentimentIcon(item.sentiment_label || 'neutral')}
                              <span className="ml-1 capitalize">{item.sentiment_label || 'neutral'}</span>
                            </Badge>
                            {item.category && (
                              <Badge variant="outline">{item.category}</Badge>
                            )}
                          </div>
                          
                          <p className="text-gray-700 mb-2">{item.comment}</p>
                          
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                            {item.response && (
                              <span className="text-green-600">✓ Responded</span>
                            )}
                          </div>

                          {/* Response Section */}
                          {item.response && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                              <p className="text-sm font-medium text-blue-900 mb-1">Your Response:</p>
                              <p className="text-sm text-blue-800">{item.response}</p>
                              <p className="text-xs text-blue-600 mt-1">
                                {new Date(item.responded_at!).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="ml-4">
                          {!item.response ? (
                            <Button
                              size="sm"
                              onClick={() => setShowResponseForm(item.id)}
                              variant="outline"
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Respond
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => setShowResponseForm(item.id)}
                              variant="outline"
                            >
                              <Edit3 className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Response Form */}
                      {showResponseForm === item.id && (
                        <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                          <Textarea
                            placeholder="Write your response..."
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            className="mb-3"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => addResponse(item.id)}
                              disabled={!responseText.trim()}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Send Response
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowResponseForm(null);
                                setResponseText('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {feedback.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No feedback found matching your criteria.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="responses" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Response Management</CardTitle>
                  <CardDescription>
                    Track your responses to customer feedback
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {feedback.filter(f => f.response).map((item) => (
                      <div key={item.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{item.customer_name}</span>
                          <span className="text-sm text-gray-500">
                            {new Date(item.responded_at!).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mb-2">
                          <p className="text-sm text-gray-600 mb-1">Customer Feedback:</p>
                          <p className="text-gray-800">{item.comment}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Your Response:</p>
                          <p className="text-gray-800">{item.response}</p>
                        </div>
                      </div>
                    ))}

                    {feedback.filter(f => f.response).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No responses yet. Start responding to customer feedback!</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
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
