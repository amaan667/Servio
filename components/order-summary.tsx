"use client";

import { useState, useEffect } from "react";
import { Check, Clock, User, Phone, Receipt, Star, ChefHat, CheckCircle, Truck, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UnifiedFeedbackForm from "@/components/UnifiedFeedbackForm";
import { createClient } from '@/lib/supabase/client';

interface OrderSummaryProps {
  orderId?: string;
  sessionId?: string;
  orderData?: any;
  isDemo?: boolean;
  onClose?: () => void;
}

interface OrderTimelineItem {
  status: string;
  label: string;
  icon: any;
  timestamp?: string;
  completed: boolean;
  current: boolean;
}

const ORDER_STATUSES = {
  PLACED: { label: 'Order Placed', icon: Receipt, color: 'bg-blue-100 text-blue-800' },
  ACCEPTED: { label: 'Order Accepted', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  IN_PREP: { label: 'Preparing', icon: ChefHat, color: 'bg-orange-100 text-orange-800' },
  READY: { label: 'Ready for Pickup', icon: UtensilsCrossed, color: 'bg-purple-100 text-purple-800' },
  SERVING: { label: 'Serving', icon: Truck, color: 'bg-indigo-100 text-indigo-800' },
  COMPLETED: { label: 'Completed', icon: Check, color: 'bg-green-100 text-green-800' },
};

export default function OrderSummary({ orderId, sessionId, orderData, isDemo = false, onClose }: OrderSummaryProps) {
  const [order, setOrder] = useState<any>(orderData);
  const [loading, setLoading] = useState(!orderData);
  const [error, setError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Generate short order number for display
  const getShortOrderNumber = (orderId: string) => {
    return orderId.slice(-6).toUpperCase();
  };

  // Map item names to their corresponding image filenames
  const getItemImagePath = (itemName: string) => {
    const imageMap: { [key: string]: string } = {
      'Cappuccino': 'cappuccino.svg',
      'Latte': 'latte.svg',
      'Americano': 'americano.svg',
      'Mocha': 'mocha.svg',
      'Flat White': 'flat-white.svg',
      'Iced Coffee': 'iced-coffee.svg',
      'Fresh Orange Juice': 'orange-juice.svg',
      'Sparkling Water': 'sparkling-water.svg',
      'Green Tea': 'green-tea.svg',
      'Smoothie Bowl': 'smoothie-bowl.svg',
      'Croissant': 'croissant.svg',
      'Pain au Chocolat': 'pain-au-chocolat.svg',
      'Blueberry Muffin': 'blueberry-muffin.svg',
      'Cinnamon Roll': 'cinnamon-roll.svg',
      'Avocado Toast': 'avocado-toast.svg',
      'Club Sandwich': 'club-sandwich.svg',
      'Caesar Salad': 'caesar-salad.svg',
      'Quiche Lorraine': 'quiche-lorraine.svg',
      'Chicken Panini': 'chicken-panini.svg',
      'Soup of the Day': 'soup-of-day.svg',
      'Chocolate Cake': 'chocolate-cake.svg',
      'Tiramisu': 'tiramisu.svg',
      'Cheesecake': 'cheesecake.svg',
      'Apple Pie': 'apple-pie.svg',
      'Ice Cream Sundae': 'ice-cream-sundae.svg',
    };
    
    return imageMap[itemName] || null;
  };

  // Get payment success message based on payment method
  const getPaymentSuccessMessage = (paymentMethod: string, paymentStatus: string) => {
    if (paymentStatus === 'PAID') {
      if (paymentMethod === 'demo' || paymentMethod === 'stripe') {
        return {
          title: "✅ Payment Successful",
          description: "Your order has been confirmed and sent to the kitchen."
        };
      } else if (paymentMethod === 'till' || paymentMethod === 'later') {
        return {
          title: "✅ Order Created Successfully", 
          description: "Your order has been placed and will be prepared."
        };
      }
    }
    return {
      title: "✅ Order Confirmed",
      description: "Your order has been received and is being processed."
    };
  };

  // Fetch order data
  useEffect(() => {
    
    if (orderData) {
      setOrder(orderData);
      setLoading(false);
      return;
    }

    // For demo orders, don't try to fetch from database
    if (isDemo && orderId && orderId.startsWith('demo-')) {
      // Keep loading while parent component reconstructs data from URL params
      // The parent (payment success page) will pass orderData via props once ready
      return; // Exit early, keep loading state
    }

    if (!orderId && !sessionId) {
      setError('No order information provided');
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        setLoading(true);
        
        if (sessionId) {
          // Fetch order by Stripe session ID
          const res = await fetch(`/api/orders/by-session/${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.ok && data.order) {
              setOrder(data.order);
            } else {
              throw new Error('Order not found for this session');
            }
          } else {
            const errorData = await res.json();
            throw new Error(`Failed to fetch order by session ID: ${errorData.error || 'Unknown error'}`);
          }
        } else if (orderId) {
          // Fetch order by ID
          const res = await fetch(`/api/orders/${orderId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.order) {
              setOrder(data.order);
            } else {
              throw new Error('Order data not found in response');
            }
          } else {
            const errorData = await res.json();
            throw new Error(`Failed to fetch order: ${errorData.error || 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, sessionId, orderData, isDemo]);

  // Set up real-time subscription for order updates
  useEffect(() => {
    if (!order?.id) return;

    const supabase = createClient();
    if (!supabase) return;

    
    const channel = supabase
      .channel(`order-summary-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`,
        },
        (payload: any) => {
          
          if (payload.eventType === 'UPDATE') {
            
            setOrder((prevOrder: any) => {
              if (!prevOrder) return null;
              return { ...prevOrder, ...payload.new };
            });
            
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.id]);

  // Generate timeline items
  const getTimelineItems = (): OrderTimelineItem[] => {
    const statusOrder = ['PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING', 'COMPLETED'];
    const currentStatus = order?.order_status || 'PLACED';
    const currentIndex = statusOrder.indexOf(currentStatus);
    
    return statusOrder.map((status, index) => {
      const statusInfo = ORDER_STATUSES[status as keyof typeof ORDER_STATUSES];
      const completed = index <= currentIndex;
      const current = index === currentIndex;
      
      return {
        status,
        label: statusInfo.label,
        icon: statusInfo.icon,
        completed,
        current
      };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Loading your order...
            </h2>
            <p className="text-gray-900">
              Please wait while we fetch your order details.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Order Not Found
            </h2>
            <p className="text-gray-900 mb-4">{error || 'We couldn\'t find your order details.'}</p>
            <Button 
              onClick={() => window.location.href = '/order'}
              className="w-full"
            >
              Return to Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const paymentMessage = getPaymentSuccessMessage(order.payment_method, order.payment_status);
  const timelineItems = getTimelineItems();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-6 text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-green-800 mb-2">
              {paymentMessage.title}
            </h1>
            <p className="text-green-700">
              {paymentMessage.description}
            </p>
          </CardContent>
        </Card>

        {/* Customer Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-900">Customer Name</p>
                <p className="font-semibold">{order.customer_name || 'Not provided'}</p>
              </div>
              {order.customer_phone && (
                <div>
                  <p className="text-sm text-gray-900">Phone Number</p>
                  <p className="font-semibold">{order.customer_phone}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-900">Order Number</p>
                <p className="font-semibold">#{getShortOrderNumber(order.id)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-900">Table</p>
                <p className="font-semibold">{order.table_number || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-start py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {isDemo && (
                          <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-200">
                            {item.item_name && getItemImagePath(item.item_name) ? (
                              <img
                                src={`/images/menu/${getItemImagePath(item.item_name)}`}
                                alt={item.item_name}
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                  // Fallback to first letter if image fails to load
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-orange-200 rounded flex items-center justify-center text-xs font-bold text-orange-700">
                                {item.item_name?.charAt(0) || '🍽️'}
                              </div>
                            )}
                            <div 
                              className="w-8 h-8 bg-gradient-to-br from-orange-100 to-orange-200 rounded flex items-center justify-center text-xs font-bold text-orange-700"
                              style={{ display: 'none' }}
                            >
                              {item.item_name?.charAt(0) || '🍽️'}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{item.item_name || `Item ${index + 1}`}</p>
                          <p className="text-sm text-gray-900">Quantity: {item.quantity}</p>
                          {item.special_instructions && (
                            <p className="text-sm text-blue-600 italic">Note: {item.special_instructions}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">£{(item.price * item.quantity).toFixed(2)}</p>
                      <p className="text-sm text-gray-900">£{item.price.toFixed(2)} each</p>
                    </div>
                  </div>
                ))}
                
                {/* Total */}
                <div className="pt-4 border-t-2 border-gray-200">
                  <div className="flex justify-between items-center">
                    <p className="text-lg font-bold">Total</p>
                    <p className="text-lg font-bold">£{order.total_amount?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Timeline */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Order Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timelineItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.status} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      item.completed 
                        ? 'bg-green-100 text-green-600' 
                        : item.current 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${
                        item.completed ? 'text-green-800' : item.current ? 'text-blue-800' : 'text-gray-900'
                      }`}>
                        {item.label}
                      </p>
                      {item.current && (
                        <p className="text-sm text-blue-600">In progress</p>
                      )}
                    </div>
                    {item.completed && (
                      <Check className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-xs text-gray-900 text-center">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>

        {/* Feedback Section */}
        {!showFeedback && !feedbackSubmitted && (
          <Card className="mb-6">
            <CardContent className="p-6 text-center">
              <Star className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">How was your experience?</h3>
              <p className="text-gray-900 mb-4">
                We'd love to hear your feedback to help us improve our service.
              </p>
              <Button 
                onClick={() => setShowFeedback(true)}
                variant="outline"
                className="w-full"
              >
                Leave Feedback
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Feedback Form */}
        {showFeedback && !feedbackSubmitted && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Share Your Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <UnifiedFeedbackForm
                orderId={order.id}
                venueId={order.venue_id}
                customerName={order.customer_name}
                customerPhone={order.customer_phone}
                onSubmit={() => {
                  setFeedbackSubmitted(true);
                  setShowFeedback(false);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Thank You Message */}
        {feedbackSubmitted && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-6 text-center">
              <Check className="h-8 w-8 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                Thank you for your feedback!
              </h3>
              <p className="text-green-700">
                Your input helps us provide better service.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button 
            onClick={() => {
              // Preserve demo flag when going back to order page
              const isDemoMode = order?.venue_id === 'demo-cafe' || isDemo;
              const url = isDemoMode ? '/order?venue=demo-cafe&table=1&demo=1' : '/order';
              window.location.href = url;
            }}
            variant="outline"
            className="flex-1"
          >
            Place Another Order
          </Button>
          <Button 
            onClick={() => window.close()}
            className="flex-1"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
