"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, User, Hash, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface OrderSummary {
  id: string;
  venue_id: string;
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
  }>;
  created_at: string;
  notes?: string;
}

export default function OrderSummaryPage() {
  const router = useRouter();
  const params = useParams();
  const venueId = params.venueId as string;
  const tableId = params.tableId as string;
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to fetch from orders table directly
        let { data, error: viewError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (viewError) {
          // Fallback to regular orders table
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

          if (orderError) {
            throw new Error('Order not found');
          }

          data = orderData;
        }

        if (!data) {
          throw new Error('Order not found');
        }

        setOrder(data as OrderSummary);
      } catch (err: any) {
        console.error('[ORDER SUMMARY] Error fetching order:', err);
        setError(err.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handleOrderAgain = () => {
    router.replace(`/order/${venueId}/${tableId}`);
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "PLACED":
        return { label: "Order Placed", color: "bg-yellow-100 text-yellow-800", icon: Clock };
      case "ACCEPTED":
        return { label: "Order Accepted", color: "bg-green-100 text-green-800", icon: CheckCircle };
      case "IN_PREP":
        return { label: "In Preparation", color: "bg-blue-100 text-blue-800", icon: Clock };
      case "READY":
        return { label: "Ready for Pickup", color: "bg-orange-100 text-orange-800", icon: CheckCircle };
      case "SERVING":
        return { label: "Being Served", color: "bg-purple-100 text-purple-800", icon: CheckCircle };
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-servio-purple mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-red-600">Order Not Found</CardTitle>
            <CardDescription>
              {error || "The order you're looking for doesn't exist or you don't have permission to view it."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleOrderAgain} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Menu
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusDisplay = getStatusDisplay(order.order_status);
  const paymentStatusDisplay = getPaymentStatusDisplay(order.payment_status);
  const StatusIcon = statusDisplay.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
          <p className="text-gray-600">Thank you for your order. We'll start preparing it right away.</p>
        </div>

        {/* Order Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl">Order #{order.id.slice(0, 8)}</CardTitle>
                <CardDescription className="flex items-center space-x-2 mt-2">
                  <Hash className="h-4 w-4" />
                  <span>Table {order.table_number}</span>
                  <span>•</span>
                  <Clock className="h-4 w-4" />
                  <span>{new Date(order.created_at).toLocaleString('en-GB')}</span>
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-servio-purple">
                  £{(() => {
                    // Calculate total from items if total_amount is 0 or missing
                    let amount = order.total_amount;
                    if (!amount || amount <= 0) {
                      amount = order.items.reduce((sum, item) => {
                        const quantity = Number(item.quantity) || 0;
                        const price = Number(item.price) || 0;
                        return sum + (quantity * price);
                      }, 0);
                    }
                    return amount.toFixed(2);
                  })()}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Status Badges */}
            <div className="flex items-center space-x-2 mb-4">
              <Badge className={statusDisplay.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusDisplay.label}
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
                <div key={index} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {item.quantity} × {item.item_name}
                    </div>
                    {item.specialInstructions && (
                      <div className="text-sm text-gray-500 mt-1">
                        Note: {item.specialInstructions}
                      </div>
                    )}
                  </div>
                  <div className="text-right font-medium text-gray-900">
                    £{(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
              <span className="text-lg font-semibold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-servio-purple">
                £{(() => {
                  // Calculate total from items if total_amount is 0 or missing
                  let amount = order.total_amount;
                  if (!amount || amount <= 0) {
                    amount = order.items.reduce((sum, item) => {
                      const quantity = Number(item.quantity) || 0;
                      const price = Number(item.price) || 0;
                      return sum + (quantity * price);
                    }, 0);
                  }
                  return amount.toFixed(2);
                })()}
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
          <Button onClick={handleOrderAgain} className="w-full bg-servio-purple hover:bg-servio-purple/90">
            Order Again
          </Button>
          
          <div className="text-center">
            <p className="text-sm text-gray-500">
              Need help? Contact the staff.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
