"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, User, Hash, ChefHat, UtensilsCrossed, Truck, Coffee } from "lucide-react";
import PaymentSimulation from "@/components/payment-simulation";
import SimpleFeedbackForm from "@/components/SimpleFeedbackForm";
import { createClient } from "@/lib/supabase/client";

interface OrderSummary {
  id: string;
  venue_id: string;
  venue_name?: string;
  table_number: number;
  customer_name: string;
  customer_phone?: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  items: Array<{
    item_name: string;
    quantity: number;
    price: number;
    specialInstructions?: string;
    image?: string;
  }>;
  created_at: string;
  updated_at?: string;
  notes?: string;
}

export default function OrderSummaryPage() {
  const router = useRouter();
  const params = useParams();
  
  if (!params) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L3.732 16.5c-.77-.833-1.964-.833-2.732 0L3.732 16.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid URL</h2>
          <p className="text-gray-600 mb-4">The order URL is invalid.</p>
          <button 
            onClick={() => router.push('/')} 
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }
  
  const venueId = params.venueId as string;
  const tableId = params.tableId as string;
  const orderId = params.orderId as string;
  
  // Check if this is a demo order
  const isDemo = venueId === 'demo-cafe' || orderId.startsWith('demo-');
  
  if (isDemo) {
    return <DemoOrderSummaryClient venueId={venueId} tableId={tableId} orderId={orderId} isDemo={true} />;
  }
  
  // For real orders, handle them directly
  return <RealOrderSummaryClient venueId={venueId} tableId={tableId} orderId={orderId} />;
}

function DemoOrderSummaryClient({ venueId, tableId, orderId, isDemo }: { venueId: string; tableId: string; orderId: string; isDemo: boolean }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>("PLACED");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get demo order data from localStorage
        const demoOrderData = localStorage.getItem('demo-order-data');
        
        if (!demoOrderData) {
          throw new Error('Demo order data not found');
        }

        const orderData = JSON.parse(demoOrderData);
        setOrder(orderData);
      } catch (err: any) {
        console.error('[DEMO ORDER SUMMARY] Error fetching demo order:', err);
        setError(err.message || 'Failed to load demo order');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  // Set up real-time subscription for order status updates
  useEffect(() => {
    if (!orderId || !venueId) return;

    const supabase = createClient();
    if (!supabase) return;

    console.log('[DEMO ORDER SUMMARY] Setting up real-time subscription for order:', orderId);

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload: any) => {
          console.log('[DEMO ORDER SUMMARY] Order status updated via real-time:', payload);
          if (payload.new && payload.new.order_status) {
            console.log('[DEMO ORDER SUMMARY] Previous status:', currentStatus, 'New status:', payload.new.order_status);
            setCurrentStatus(payload.new.order_status);
            console.log('[DEMO ORDER SUMMARY] Updated status to:', payload.new.order_status);
            
            // Additional debugging for COMPLETED status
            if (payload.new.order_status === 'COMPLETED') {
              console.log('[DEMO ORDER SUMMARY] 🎉 Order marked as COMPLETED!');
            }
          }
        }
      )
      .subscribe((status: any) => {
        console.log('[DEMO ORDER SUMMARY] Real-time subscription status:', status);
      });

    return () => {
      console.log('[DEMO ORDER SUMMARY] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [orderId, venueId]);

  // Real-time updates now handle status progression instead of demo timers

  const handleOrderAgain = () => {
    router.replace(`/order?demo=1`);
  };

  const handlePaymentComplete = async () => {
    try {
      // Update order payment status to PAID
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payment_status: 'PAID',
          order_status: 'PLACED' // Ensure order is in PLACED status
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update payment status');
      }

      setPaymentCompleted(true);
      setShowPayment(false);
      // Show feedback form after payment
      setShowFeedback(true);
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Payment completed but failed to update order status. Please contact support.');
      // Still show success UI even if update failed
      setPaymentCompleted(true);
      setShowPayment(false);
      setShowFeedback(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading demo order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L3.732 16.5c-.77-.833-1.964-.833-2.732 0L3.732 16.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Demo order not found</h2>
          <p className="text-gray-600 mb-4">{error || 'The demo order could not be loaded.'}</p>
          <button 
            onClick={() => router.push('/order?demo=1')} 
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Try Demo Again
          </button>
        </div>
      </div>
    );
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "PLACED":
        return { label: "Order Placed", color: "bg-yellow-100 text-yellow-800", icon: Clock };
      case "ACCEPTED":
        return { label: "Order Accepted", color: "bg-green-100 text-green-800", icon: CheckCircle };
      case "IN_PREP":
        return { label: "In Preparation", color: "bg-blue-100 text-blue-800", icon: ChefHat };
      case "READY":
        return { label: "Ready for Pickup", color: "bg-orange-100 text-orange-800", icon: UtensilsCrossed };
      case "SERVING":
        return { label: "Being Served", color: "bg-purple-100 text-purple-800", icon: Truck };
      case "COMPLETED":
        return { label: "Order Completed", color: "bg-gray-100 text-gray-800", icon: CheckCircle };
      default:
        return { label: status.toUpperCase(), color: "bg-gray-100 text-gray-800", icon: Clock };
    }
  };

  const getPaymentStatusDisplay = (status: string) => {
    switch (status) {
      case "PAID":
        return { label: "PAID", color: "bg-green-100 text-green-800" };
      case "IN_PROGRESS":
        return { label: "PAYMENT IN PROGRESS", color: "bg-yellow-100 text-yellow-800" };
      case "UNPAID":
        return { label: "UNPAID", color: "bg-red-100 text-red-800" };
      default:
        return { label: status.toUpperCase(), color: "bg-gray-100 text-gray-800" };
    }
  };

  const statusDisplay = getStatusDisplay(currentStatus);
  const paymentStatusDisplay = getPaymentStatusDisplay(order.payment_status);
  const StatusIcon = statusDisplay.icon;

  // Calculate total amount
  const totalAmount = order.total_amount > 0 ? order.total_amount : 
    order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header with Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full mb-4 shadow-lg">
            <Coffee className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Servio Café</h1>
          <p className="text-lg text-purple-600 font-medium mb-2">Modern Bistro & Coffee House</p>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h2>
          <p className="text-gray-600">Thank you for your order. We'll start preparing it right away.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Order Summary */}
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">Order #{order.id.slice(0, 8)}</CardTitle>
                    <CardDescription className="flex items-center space-x-2 mt-2">
                      <Hash className="h-4 w-4" />
                      <span>Servio Café - Table {order.table_number}</span>
                      <span>•</span>
                      <Clock className="h-4 w-4" />
                      <span>{new Date(order.created_at).toLocaleString('en-GB')}</span>
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">
                      £{totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Status Badges */}
                <div className="flex items-center space-x-2 mb-4">
                  <Badge className={statusDisplay.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    <span>{statusDisplay.label}</span>
                  </Badge>
                  <Badge className={paymentStatusDisplay.color}>
                    {paymentStatusDisplay.label}
                  </Badge>
                </div>

                {/* Customer Info */}
                <div className="flex items-center space-x-2 mb-4 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  <span>{order.customer_name}</span>
                  {order.customer_phone && (
                    <>
                      <span>•</span>
                      <span>{order.customer_phone}</span>
                    </>
                  )}
                </div>

                {/* Order Items with Images */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Order Items</h3>
                  {order.items.map((item, index) => (
                    <div key={index} className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">
                          {item.quantity} × {item.item_name}
                        </div>
                        {item.specialInstructions && (
                          <div className="text-sm text-gray-500 mt-1">
                            Note: {item.specialInstructions}
                          </div>
                        )}
                      </div>
                      
                      {/* Item Price */}
                      <div className="text-right font-medium text-gray-900 flex-shrink-0">
                        £{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-purple-600">
                    £{totalAmount.toFixed(2)}
                  </span>
                </div>

                {/* Notes */}
                {order.notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-1">Special Instructions</h4>
                    <p className="text-sm text-gray-600">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Order Again button is now shown under the feedback form after payment completion */}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Payment Simulation */}
            {!paymentCompleted && (
              <PaymentSimulation 
                amount={totalAmount} 
                onPaymentComplete={handlePaymentComplete}
              />
            )}

            {/* Feedback Form */}
            {showFeedback && (
              <div className="space-y-4">
                <SimpleFeedbackForm 
                  venueId={venueId} 
                  orderId={orderId}
                  onSubmit={() => setShowFeedback(false)}
                />
                <Button onClick={handleOrderAgain} className="w-full bg-purple-600 hover:bg-purple-700">
                  Order Again
                </Button>
              </div>
            )}

            {/* Order Status Timeline - Only show after payment completion */}
            {paymentCompleted && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Order Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { status: "PLACED", label: "Order Placed", icon: Clock },
                      { status: "ACCEPTED", label: "Order Accepted", icon: CheckCircle },
                      { status: "IN_PREP", label: "In Preparation", icon: ChefHat },
                      { status: "READY", label: "Ready for Pickup", icon: UtensilsCrossed },
                      { status: "SERVING", label: "Being Served", icon: Truck },
                      { status: "COMPLETED", label: "Order Completed", icon: CheckCircle }
                    ].map((step, index) => {
                      const isActive = currentStatus === step.status;
                      const isCompleted = (() => {
                        // Define the order progression
                        const statusOrder = ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING", "COMPLETED"];
                        const currentIndex = statusOrder.indexOf(currentStatus);
                        const stepIndex = statusOrder.indexOf(step.status);
                        
                        // A step is completed if it comes before or equals the current status
                        return stepIndex <= currentIndex;
                      })();
                      
                      // Calculate relative time for completed steps
                      const getTimeDisplay = (status: string) => {
                        if (status === "PLACED") return "Now";
                        if (!isCompleted) return "Pending";
                        
                        // For demo orders, show estimated times
                        if (isDemo) {
                          const timeMap: { [key: string]: string } = {
                            "ACCEPTED": "+5s",
                            "IN_PREP": "+15s", 
                            "READY": "+30s",
                            "SERVING": "+45s",
                            "COMPLETED": "+60s"
                          };
                          return timeMap[status] || "Pending";
                        }
                        
                        // For real orders, show actual timestamps if available
                        if (order && order.updated_at) {
                          const orderTime = new Date(order.created_at);
                          const now = new Date();
                          const diffMs = now.getTime() - orderTime.getTime();
                          const diffMins = Math.floor(diffMs / 60000);
                          if (diffMins < 1) return "Just now";
                          if (diffMins < 60) return `+${diffMins}m`;
                          const diffHours = Math.floor(diffMins / 60);
                          return `+${diffHours}h`;
                        }
                        
                        return "Pending";
                      };
                      
                      return (
                        <div key={step.status} className="flex items-center space-x-3">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            isCompleted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {isCompleted ? <CheckCircle className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${
                              isActive ? 'text-purple-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                            }`}>
                              {step.label}
                            </div>
                            <div className="text-xs text-gray-400">{getTimeDisplay(step.status)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RealOrderSummaryClient({ venueId, tableId, orderId }: { venueId: string; tableId: string; orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>("PLACED");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch real order from API
        const response = await fetch(`/api/orders/${orderId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch order');
        }

        const orderData = await response.json();
        setOrder(orderData);
        // Set the current status from the fetched order
        if (orderData.order_status) {
          setCurrentStatus(orderData.order_status);
        }
      } catch (err: any) {
        console.error('[REAL ORDER SUMMARY] Error fetching order:', err);
        setError(err.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  // Set up real-time subscription for order status updates
  useEffect(() => {
    if (!orderId || !venueId) return;

    const supabase = createClient();
    if (!supabase) return;

    console.log('[REAL ORDER SUMMARY] Setting up real-time subscription for order:', orderId);

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload: any) => {
          console.log('[REAL ORDER SUMMARY] Order status updated via real-time:', payload);
          if (payload.new && payload.new.order_status) {
            console.log('[REAL ORDER SUMMARY] Previous status:', currentStatus, 'New status:', payload.new.order_status);
            setCurrentStatus(payload.new.order_status);
            console.log('[REAL ORDER SUMMARY] Updated status to:', payload.new.order_status);
            
            // Additional debugging for COMPLETED status
            if (payload.new.order_status === 'COMPLETED') {
              console.log('[REAL ORDER SUMMARY] 🎉 Order marked as COMPLETED!');
            }
            
            // Also update the order object with the new status
            setOrder(prevOrder => {
              if (prevOrder && prevOrder.id === orderId) {
                return { ...prevOrder, order_status: payload.new.order_status };
              }
              return prevOrder;
            });
          }
        }
      )
      .subscribe((status: any) => {
        console.log('[REAL ORDER SUMMARY] Real-time subscription status:', status);
      });

    return () => {
      console.log('[REAL ORDER SUMMARY] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [orderId, venueId]);

  const handlePaymentComplete = async () => {
    try {
      // Update order payment status to PAID
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payment_status: 'PAID',
          order_status: 'PLACED' // Ensure order is in PLACED status
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update payment status');
      }

      setPaymentCompleted(true);
      setShowPayment(false);
      // Show feedback form after payment
      setShowFeedback(true);
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Payment completed but failed to update order status. Please contact support.');
      // Still show success UI even if update failed
      setPaymentCompleted(true);
      setShowPayment(false);
      setShowFeedback(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L3.732 16.5c-.77-.833-1.964-.833-2.732 0L3.732 16.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Order not found</h2>
          <p className="text-gray-600 mb-4">{error || 'The order could not be loaded.'}</p>
          <button 
            onClick={() => router.push('/')} 
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "PLACED":
        return { label: "Order Placed", color: "bg-yellow-100 text-yellow-800", icon: Clock };
      case "ACCEPTED":
        return { label: "Order Accepted", color: "bg-green-100 text-green-800", icon: CheckCircle };
      case "IN_PREP":
        return { label: "In Preparation", color: "bg-blue-100 text-blue-800", icon: ChefHat };
      case "READY":
        return { label: "Ready for Pickup", color: "bg-orange-100 text-orange-800", icon: UtensilsCrossed };
      case "SERVING":
        return { label: "Being Served", color: "bg-purple-100 text-purple-800", icon: Truck };
      case "COMPLETED":
        return { label: "Order Completed", color: "bg-gray-100 text-gray-800", icon: CheckCircle };
      default:
        return { label: status.toUpperCase(), color: "bg-gray-100 text-gray-800", icon: Clock };
    }
  };

  const getPaymentStatusDisplay = (status: string) => {
    switch (status) {
      case "PAID":
        return { label: "PAID", color: "bg-green-100 text-green-800" };
      case "IN_PROGRESS":
        return { label: "PAYMENT IN PROGRESS", color: "bg-yellow-100 text-yellow-800" };
      case "UNPAID":
        return { label: "UNPAID", color: "bg-red-100 text-red-800" };
      default:
        return { label: status.toUpperCase(), color: "bg-gray-100 text-gray-800" };
    }
  };

  const statusDisplay = getStatusDisplay(currentStatus);
  const paymentStatusDisplay = getPaymentStatusDisplay(order.payment_status);
  const StatusIcon = statusDisplay.icon;

  // Calculate total amount
  const totalAmount = order.total_amount > 0 ? order.total_amount : 
    order.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header with Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full mb-4 shadow-lg">
            <Coffee className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{order.venue_name || 'Our Venue'}</h1>
          <p className="text-lg text-purple-600 font-medium mb-2">Order Confirmation</p>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h2>
          <p className="text-gray-600">Thank you for your order. We'll start preparing it right away.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Order Summary */}
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">Order #{order.id.slice(0, 8)}</CardTitle>
                    <CardDescription className="flex items-center space-x-2 mt-2">
                      <Hash className="h-4 w-4" />
                      <span>{order.venue_name || 'Our Venue'} - Table {order.table_number}</span>
                      <span>•</span>
                      <Clock className="h-4 w-4" />
                      <span>{new Date(order.created_at).toLocaleString('en-GB')}</span>
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">
                      £{totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Status Badges */}
                <div className="flex items-center space-x-2 mb-4">
                  <Badge className={statusDisplay.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    <span>{statusDisplay.label}</span>
                  </Badge>
                  <Badge className={paymentStatusDisplay.color}>
                    {paymentStatusDisplay.label}
                  </Badge>
                </div>

                {/* Customer Info */}
                <div className="flex items-center space-x-2 mb-4 text-sm text-gray-600">
                  <User className="h-4 w-4" />
                  <span>{order.customer_name}</span>
                  {order.customer_phone && (
                    <>
                      <span>•</span>
                      <span>{order.customer_phone}</span>
                    </>
                  )}
                </div>

                {/* Order Items */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Order Items</h3>
                  {order.items.map((item, index) => (
                    <div key={index} className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">
                          {item.quantity} × {item.item_name}
                        </div>
                        {item.specialInstructions && (
                          <div className="text-sm text-gray-500 mt-1">
                            Note: {item.specialInstructions}
                          </div>
                        )}
                      </div>
                      
                      {/* Item Price */}
                      <div className="text-right font-medium text-gray-900 flex-shrink-0">
                        £{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-purple-600">
                    £{totalAmount.toFixed(2)}
                  </span>
                </div>

                {/* Notes */}
                {order.notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-1">Special Instructions</h4>
                    <p className="text-sm text-gray-600">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Order Again button is now shown under the feedback form after payment completion */}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Payment Simulation */}
            {!paymentCompleted && (
              <PaymentSimulation 
                amount={totalAmount} 
                onPaymentComplete={handlePaymentComplete}
              />
            )}

            {/* Feedback Form */}
            {showFeedback && (
              <div className="space-y-4">
                <SimpleFeedbackForm 
                  venueId={venueId} 
                  orderId={orderId}
                  onSubmit={() => setShowFeedback(false)}
                />
                <Button onClick={() => router.push(`/order?venue=${venueId}&table=${tableId}`)} className="w-full bg-purple-600 hover:bg-purple-700">
                  Order Again
                </Button>
              </div>
            )}

            {/* Order Status Timeline - Only show after payment completion */}
            {paymentCompleted && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Order Timeline</CardTitle>
                  <div className="text-sm text-gray-500">
                    Current Status: <span className="font-medium text-purple-600">{currentStatus}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { status: "PLACED", label: "Order Placed", icon: Clock },
                      { status: "ACCEPTED", label: "Order Accepted", icon: CheckCircle },
                      { status: "IN_PREP", label: "In Preparation", icon: ChefHat },
                      { status: "READY", label: "Ready for Pickup", icon: UtensilsCrossed },
                      { status: "SERVING", label: "Being Served", icon: Truck },
                      { status: "COMPLETED", label: "Order Completed", icon: CheckCircle }
                    ].map((step, index) => {
                      const isActive = currentStatus === step.status;
                      const isCompleted = ["ACCEPTED", "IN_PREP", "READY", "SERVING", "COMPLETED"].indexOf(step.status) <= 
                        ["ACCEPTED", "IN_PREP", "READY", "SERVING", "COMPLETED"].indexOf(currentStatus);
                      
                      // Calculate relative time for completed steps
                      const getTimeDisplay = (status: string) => {
                        if (status === "PLACED") return "Now";
                        if (!isCompleted) return "Pending";
                        
                        // For real orders, show actual timestamps if available
                        if (order && order.updated_at) {
                          const orderTime = new Date(order.created_at);
                          const now = new Date();
                          const diffMs = now.getTime() - orderTime.getTime();
                          const diffMins = Math.floor(diffMs / 60000);
                          if (diffMins < 1) return "Just now";
                          if (diffMins < 60) return `+${diffMins}m`;
                          const diffHours = Math.floor(diffMins / 60);
                          return `+${diffHours}h`;
                        }
                        
                        return "Pending";
                      };
                      
                      return (
                        <div key={step.status} className="flex items-center space-x-3">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            isCompleted ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {isCompleted ? <CheckCircle className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${
                              isActive ? 'text-purple-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
                            }`}>
                              {step.label}
                            </div>
                            <div className="text-xs text-gray-400">{getTimeDisplay(step.status)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
