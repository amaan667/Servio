"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  User, 
  Hash, 
  Star,
  MessageSquare,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

interface OrderItem {
  menu_item_id: string;
  quantity: number;
  price: number;
  item_name: string;
  specialInstructions?: string;
}

interface Order {
  id: string;
  venue_id: string;
  table_number: number;
  counter_number?: number;
  order_type?: 'table' | 'counter';
  order_location?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
  source?: 'qr' | 'counter';
}

interface FeedbackQuestion {
  id: string;
  prompt: string;
  type: 'stars' | 'paragraph' | 'multiple_choice';
  choices?: string[];
  is_active: boolean;
  sort_index: number;
}

interface FeedbackResponse {
  question_id: string;
  type: string;
  answer_stars?: number;
  answer_text?: string;
  answer_choice?: string;
}

// Table order timeline (includes serving step)
const TABLE_ORDER_STATUSES = [
  { key: 'PLACED', label: 'Order Placed', icon: CheckCircle, color: 'bg-green-100 text-green-800', description: 'Order has been placed.' },
  { key: 'ACCEPTED', label: 'Order Accepted', icon: CheckCircle, color: 'bg-green-100 text-green-800', description: 'Your order has been accepted by the kitchen.' },
  { key: 'IN_PREP', label: 'In Preparation', icon: RefreshCw, color: 'bg-orange-100 text-orange-800', description: 'Your order is being prepared in the kitchen.' },
  { key: 'READY', label: 'Ready for Pickup / Serving', icon: CheckCircle, color: 'bg-blue-100 text-blue-800', description: 'Your order is ready for pickup / serving.' },
  { key: 'SERVING', label: 'Being Served', icon: CheckCircle, color: 'bg-purple-100 text-purple-800', description: 'Your order has been served. Enjoy your meal!' },
  { key: 'COMPLETED', label: 'Completed', icon: CheckCircle, color: 'bg-green-100 text-green-800', description: 'Thank you for your order!' }
];

// Counter order timeline (no serving step - goes directly from ready to completed)
const COUNTER_ORDER_STATUSES = [
  { key: 'PLACED', label: 'Order Placed', icon: CheckCircle, color: 'bg-green-100 text-green-800', description: 'Order has been placed.' },
  { key: 'ACCEPTED', label: 'Order Accepted', icon: CheckCircle, color: 'bg-green-100 text-green-800', description: 'Your order has been accepted by the kitchen.' },
  { key: 'IN_PREP', label: 'In Preparation', icon: RefreshCw, color: 'bg-orange-100 text-orange-800', description: 'Your order is being prepared in the kitchen.' },
  { key: 'READY', label: 'Ready for Pickup', icon: CheckCircle, color: 'bg-blue-100 text-blue-800', description: 'Your order is ready for pickup at the counter.' },
  { key: 'COMPLETED', label: 'Completed', icon: CheckCircle, color: 'bg-green-100 text-green-800', description: 'Thank you for your order!' }
];

const GREYED_OUT_STATUSES = [
  { key: 'CANCELLED', label: 'Order Cancelled', icon: XCircle, color: 'bg-red-100 text-red-800', description: 'Your order has been cancelled' },
  { key: 'REFUNDED', label: 'Order Refunded', icon: XCircle, color: 'bg-red-100 text-red-800', description: 'Your order has been refunded' },
  { key: 'EXPIRED', label: 'Order Expired', icon: XCircle, color: 'bg-gray-100 text-gray-800', description: 'Your order has expired' }
];

// Generic feedback questions if no custom ones exist
const GENERIC_QUESTIONS: FeedbackQuestion[] = [
  {
    id: 'generic-1',
    prompt: 'How would you rate your overall experience?',
    type: 'stars',
    is_active: true,
    sort_index: 1
  },
  {
    id: 'generic-2',
    prompt: 'How was the food quality?',
    type: 'stars',
    is_active: true,
    sort_index: 2
  },
  {
    id: 'generic-3',
    prompt: 'How was the service?',
    type: 'stars',
    is_active: true,
    sort_index: 3
  },
  {
    id: 'generic-4',
    prompt: 'Would you recommend us to others?',
    type: 'multiple_choice',
    choices: ['Yes, definitely', 'Yes, probably', 'Maybe', 'No, probably not', 'No, definitely not'],
    is_active: true,
    sort_index: 4
  },
  {
    id: 'generic-5',
    prompt: 'Any additional comments or suggestions?',
    type: 'paragraph',
    is_active: true,
    sort_index: 5
  }
];

export default function OrderSummaryPage() {
  const params = useParams();
  const orderId = params?.orderId as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [feedbackQuestions, setFeedbackQuestions] = useState<FeedbackQuestion[]>([]);
  const [feedbackResponses, setFeedbackResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const supabase = createClient();

  // Generate short order number
  const getShortOrderNumber = (orderId: string) => {
    // Use last 6 characters of UUID for shorter display
    return orderId.slice(-6).toUpperCase();
  };

  // Determine if it's a counter order
  const isCounterOrder = (order: Order) => {
    return order.source === 'counter' || order.order_type === 'counter' || !!order.counter_number;
  };

  const fetchOrder = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('Failed to fetch order:', error);
        setError('Order not found or access denied');
        return;
      }

      setOrder(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbackQuestions = async () => {
    if (!order?.venue_id) return;

    try {
      const { data, error } = await supabase
        .from('feedback_questions')
        .select('*')
        .eq('venue_id', order.venue_id)
        .eq('is_active', true)
        .order('sort_index', { ascending: true });

      if (error) {
        console.error('Failed to fetch feedback questions:', error);
        // Use generic questions as fallback
        setFeedbackQuestions(GENERIC_QUESTIONS);
        return;
      }

      // Use custom questions if available, otherwise use generic ones
      if (data && data.length > 0) {
        setFeedbackQuestions(data);
      } else {
        setFeedbackQuestions(GENERIC_QUESTIONS);
      }
    } catch (err) {
      console.error('Error fetching feedback questions:', err);
      setFeedbackQuestions(GENERIC_QUESTIONS);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    if (order) {
      fetchFeedbackQuestions();
    }
  }, [order]);

  useEffect(() => {
    // Set up real-time subscription for order updates
    if (!supabase || !orderId) return;
    
    const channel = supabase
      .channel(`order-summary-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload: any) => {
          if (payload.eventType === 'UPDATE') {
            
            setOrder(prevOrder => {
              if (!prevOrder) return null;
              return { ...prevOrder, ...payload.new };
            });
            
            setLastUpdate(new Date());
          } else if (payload.eventType === 'DELETE') {
            setError('This order has been cancelled or deleted');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, supabase]);

  const getStatusInfo = (status: string, order: Order) => {
    const statusArray = isCounterOrder(order) ? COUNTER_ORDER_STATUSES : TABLE_ORDER_STATUSES;
    return statusArray.find(s => s.key === status) || GREYED_OUT_STATUSES.find(s => s.key === status) || {
      key: status,
      label: status.replace('_', ' '),
      icon: Clock,
      color: 'bg-gray-100 text-gray-800',
      description: 'Order status update'
    };
  };

  const getCurrentStatusIndex = () => {
    if (!order) return -1;
    const statusArray = isCounterOrder(order) ? COUNTER_ORDER_STATUSES : TABLE_ORDER_STATUSES;
    return statusArray.findIndex(s => s.key === order.order_status);
  };

  const getDisplayStatuses = () => {
    if (!order) return TABLE_ORDER_STATUSES;
    
    const statusArray = isCounterOrder(order) ? COUNTER_ORDER_STATUSES : TABLE_ORDER_STATUSES;
    const currentStatus = order.order_status;
    const isGreyedOutStatus = GREYED_OUT_STATUSES.some(status => status.key === currentStatus);
    
    if (isGreyedOutStatus) {
      const greyedOutStatus = GREYED_OUT_STATUSES.find(status => status.key === currentStatus);
      return [...statusArray, greyedOutStatus!];
    }
    
    return statusArray;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleFeedbackResponse = (questionId: string, response: any) => {
    setFeedbackResponses(prev => ({
      ...prev,
      [questionId]: response
    }));
  };

  const submitFeedback = async () => {
    if (!order) return;

    setSubmittingFeedback(true);

    try {
      const answers = feedbackQuestions.map(question => {
        const response = feedbackResponses[question.id];
        if (!response) return null;

        return {
          question_id: question.id,
          type: question.type,
          answer_stars: response.stars,
          answer_text: response.text,
          answer_choice: response.choice
        };
      }).filter(Boolean);

      if (answers.length === 0) {
        toast({
          title: "No feedback provided",
          description: "Please provide at least one response before submitting.",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch('/api/feedback-responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venue_id: order.venue_id,
          order_id: order.id,
          answers
        })
      });

      if (response.ok) {
        setFeedbackSubmitted(true);
        toast({
          title: "Thank you!",
          description: "Your feedback has been submitted successfully.",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to submit feedback",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const renderStarRating = (question: FeedbackQuestion) => {
    const currentRating = feedbackResponses[question.id]?.stars || 0;
    
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleFeedbackResponse(question.id, { stars: star })}
            className="focus:outline-none"
          >
            <Star
              className={`h-8 w-8 ${
                star <= currentRating
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-600'
              }`}
            />
          </button>
        ))}
        {currentRating > 0 && (
          <span className="ml-2 text-sm text-gray-900">
            {currentRating} star{currentRating !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  };

  const renderMultipleChoice = (question: FeedbackQuestion) => {
    const currentChoice = feedbackResponses[question.id]?.choice;
    
    return (
      <RadioGroup
        value={currentChoice || ''}
        onValueChange={(value) => handleFeedbackResponse(question.id, { choice: value })}
      >
        {question.choices?.map((choice, index) => (
          <div key={index} className="flex items-center space-x-2">
            <RadioGroupItem value={choice} id={`${question.id}-${index}`} />
            <Label htmlFor={`${question.id}-${index}`} className="text-sm">
              {choice}
            </Label>
          </div>
        ))}
      </RadioGroup>
    );
  };

  const renderParagraph = (question: FeedbackQuestion) => {
    const currentText = feedbackResponses[question.id]?.text || '';
    
    return (
      <Textarea
        placeholder="Share your thoughts..."
        value={currentText}
        onChange={(e) => handleFeedbackResponse(question.id, { text: e.target.value })}
        className="min-h-[100px]"
        maxLength={500}
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-900 mb-4">{error || 'The order you are looking for could not be found.'}</p>
          <Button onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const currentStatusIndex = getCurrentStatusIndex();
  const isCounter = isCounterOrder(order);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Order Summary</h1>
          <p className="text-gray-900 text-sm sm:text-base">Track your order and share your feedback</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Order Details & Timeline */}
          <div className="space-y-6">
            {/* Order Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Order #{getShortOrderNumber(order.id)}</span>
                  <Badge variant="outline" className="text-sm">
                    {isCounter ? `Counter ${order.counter_number || order.table_number}` : `Table ${order.table_number}`}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">Customer:</span>
                    <p className="text-gray-900">{order.customer_name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Total:</span>
                    <p className="text-gray-900 font-semibold">{formatCurrency(order.total_amount)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Placed:</span>
                    <p className="text-gray-900">{formatTime(order.created_at)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Last Updated:</span>
                    <p className="text-gray-900">{formatTime(order.updated_at)}</p>
                  </div>
                </div>
                
                {order.notes && (
                  <div>
                    <span className="font-medium text-gray-900">Special Instructions:</span>
                    <p className="text-gray-900 mt-1">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Status Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Order Progress</span>
                  <Badge variant="outline" className="text-xs">
                    Live Updates
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {getDisplayStatuses().map((status, index) => {
                    const isGreyedOut = GREYED_OUT_STATUSES.some(gs => gs.key === status.key);
                    const isCompleted = !isGreyedOut && index <= currentStatusIndex;
                    const isCurrent = status.key === order?.order_status;
                    const Icon = status.icon;
                    
                    return (
                      <div key={status.key} className="flex items-start space-x-4">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          isGreyedOut
                            ? 'bg-red-500 text-white'
                            : isCompleted 
                              ? 'bg-servio-purple text-white' 
                              : 'bg-gray-200 text-gray-700'
                        }`}>
                          {isGreyedOut ? (
                            <XCircle className="h-5 w-5" />
                          ) : isCompleted ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className={`text-sm font-medium ${
                              isGreyedOut
                                ? 'text-red-600'
                                : isCurrent 
                                  ? 'text-servio-purple' 
                                  : 'text-gray-900'
                            }`}>
                              {status.label}
                            </h3>
                            {isCurrent && !isGreyedOut && (
                              <Badge className={status.color}>
                                Current
                              </Badge>
                            )}
                            {isGreyedOut && (
                              <Badge variant="destructive" className="text-xs">
                                {status.key}
                              </Badge>
                            )}
                          </div>
                          <p className={`text-sm mt-1 ${
                            isGreyedOut ? 'text-red-500' : 'text-gray-900'
                          }`}>
                            {status.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{item.item_name}</span>
                          <span className="text-sm text-gray-900">×{item.quantity}</span>
                        </div>
                        {item.specialInstructions && (
                          <p className="text-sm text-gray-900 mt-1 italic">
                            "{item.specialInstructions}"
                          </p>
                        )}
                      </div>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Feedback */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Share Your Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feedbackSubmitted ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Thank You!</h3>
                    <p className="text-gray-900">Your feedback has been submitted successfully.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {feedbackQuestions.map((question) => (
                      <div key={question.id} className="space-y-3">
                        <Label className="text-sm font-medium text-gray-900">
                          {question.prompt}
                        </Label>
                        
                        {question.type === 'stars' && renderStarRating(question)}
                        {question.type === 'multiple_choice' && renderMultipleChoice(question)}
                        {question.type === 'paragraph' && renderParagraph(question)}
                      </div>
                    ))}
                    
                    <Button 
                      onClick={submitFeedback}
                      disabled={submittingFeedback}
                      className="w-full"
                    >
                      {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-900 mt-8">
          <p>Last updated: {lastUpdate.toLocaleTimeString()}</p>
          <p className="mt-1">This page updates automatically</p>
        </div>
      </div>
    </div>
  );
}
