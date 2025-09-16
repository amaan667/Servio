"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, XCircle, AlertTriangle, User, Hash } from "lucide-react";


export type Order = {
  id: string;
  venue_id: string;
  table_number: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  order_status: 'PLACED'|'IN_PREP'|'READY'|'SERVING'|'SERVED'|'COMPLETED'|'CANCELLED'|'REFUNDED'|'EXPIRED';
  payment_status: 'unpaid'|'paid'|'till'|'UNPAID'|'PAID'|'TILL'|'PAY_LATER'|'REFUNDED';
  total_amount: number;
  calc_total_amount?: number;
  notes?: string;
  payment_method?: string;
  scheduled_for?: string;
  prep_lead_minutes?: number;
  source?: 'qr' | 'counter'; // Order source - qr for table orders, counter for counter orders
  items: Array<{
    menu_item_id: string;
    quantity: number;
    price: number;
    item_name: string;
    specialInstructions?: string;
  }>;
  created_at: string;
  updated_at: string;
};

interface OrderCardProps {
  order: Order;
  onUpdate: () => void;
  venueCurrency?: string;
}

export function OrderCard({ order, onUpdate, venueCurrency = 'GBP' }: OrderCardProps) {
  // Determine if it's a counter order - use source field as primary indicator
  const isCounterOrder = (order: Order) => {
    return order.source === 'counter';
  };
  const [updating, setUpdating] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLACED':
        return <Clock className="h-3 w-3" />;
      case 'IN_PREP':
        return <AlertTriangle className="h-3 w-3" />;
      case 'READY':
        return <CheckCircle className="h-3 w-3" />;
      case 'SERVING':
        return <CheckCircle className="h-3 w-3" />;
      case 'SERVED':
        return <CheckCircle className="h-3 w-3" />;
      case 'COMPLETED':
        return <CheckCircle className="h-3 w-3" />;
      case 'CANCELLED':
        return <XCircle className="h-3 w-3" />;
      case 'REFUNDED':
        return <XCircle className="h-3 w-3" />;
      case 'EXPIRED':
        return <AlertTriangle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLACED':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_PREP':
        return 'bg-blue-100 text-blue-800';
      case 'READY':
        return 'bg-orange-100 text-orange-800';
      case 'SERVING':
        return 'bg-purple-100 text-purple-800';
      case 'SERVED':
        return 'bg-green-100 text-green-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'REFUNDED':
        return 'bg-red-100 text-red-800';
      case 'EXPIRED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      case 'till':
        return 'bg-yellow-100 text-yellow-800';
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'UNPAID':
        return 'bg-red-100 text-red-800';
      case 'PAY_LATER':
        return 'bg-blue-100 text-blue-800';
      case 'REFUNDED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Calculate total from items if total_amount is 0 or missing
  const calculateTotalFromItems = (items: Array<{ quantity: number; price: number }>) => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      return sum + (quantity * price);
    }, 0);
  };

  // Use calculated total from items if total_amount is 0 or missing
  const amount = order.total_amount && order.total_amount > 0 
    ? order.total_amount 
    : calculateTotalFromItems(order.items);

  // Primary action button logic - removed preparing state
  function primaryActionFor(order: Order) {
    // Only hide action buttons for truly terminal states
    if (['CANCELLED','REFUNDED','EXPIRED'].includes(order.order_status)) return null;

    if (order.payment_status !== 'PAID') {
      return { label: 'Mark Paid', onClick: () => markOrderPaid(order.id) };
    }

    switch (order.order_status) {
      case 'PLACED':   return { label: 'Mark Ready', onClick: () => setOrderStatus(order.id, 'READY') };
      case 'IN_PREP':  return { label: 'Mark Ready',      onClick: () => setOrderStatus(order.id, 'READY') };
      case 'READY':    return { label: 'Start Serving',   onClick: () => setOrderStatus(order.id, 'SERVING') };
      case 'SERVING':  return { label: 'Mark Served',     onClick: () => setOrderStatus(order.id, 'SERVED') };
      case 'SERVED':   return { label: 'Mark Completed',  onClick: () => setOrderStatus(order.id, 'COMPLETED') };
      case 'COMPLETED': return { label: 'Reopen Order',   onClick: () => setOrderStatus(order.id, 'SERVING') };
      default:         return null;
    }
  }

  const primaryAction = primaryActionFor(order);

  const markOrderPaid = async (orderId: string) => {
    try {
      const response = await fetch('/api/orders/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark order as paid');
      }
    } catch (error) {
      throw error;
    }
  };

  const setOrderStatus = async (orderId: string, status: string) => {
    try {
      const response = await fetch('/api/orders/set-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to set order status');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleAction = async (action: () => Promise<void>) => {
    try {
      setUpdating(true);
      await action();
      onUpdate();
    } catch (error) {
      console.error('Action failed:', error);
      // You might want to show a toast notification here
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-xl flex items-center gap-3 mb-3">
              <Hash className="h-5 w-5 text-gray-500" />
              Order #{order.id.slice(0, 8)}
            </CardTitle>
            <div className="flex items-center gap-3 mb-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span className="font-medium">{order.customer_name}</span>
              {order.customer_phone && (
                <>
                  <span>•</span>
                  <span>{order.customer_phone}</span>
                </>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {isCounterOrder(order) ? 'Counter' : 'Table'} {order.table_number}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-servio-purple mb-2">
              {formatCurrency(amount, venueCurrency)}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Status Badges */}
        <div className="flex items-center gap-3 mb-6">
          <Badge className={`${getStatusColor(order.order_status)} text-sm font-semibold px-3 py-1.5`}>
            {getStatusIcon(order.order_status)}
            <span className="ml-2">{order.order_status.replace('_', ' ')}</span>
          </Badge>
          <Badge className={`${getPaymentStatusColor(order.payment_status)} text-sm font-semibold px-3 py-1.5`}>
            {order.payment_status === 'paid' || order.payment_status === 'PAID' ? '✅ Paid' :
             order.payment_status === 'unpaid' || order.payment_status === 'UNPAID' ? '❌ Unpaid' :
             order.payment_status === 'till' || order.payment_status === 'TILL' ? '🏪 Till' :
             order.payment_status === 'PAY_LATER' ? '⏰ Pay Later' :
             order.payment_status === 'REFUNDED' ? '🔄 Refunded' :
             order.payment_status}
          </Badge>
        </div>

        {/* Order Items */}
        <div className="space-y-3 mb-6">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-base">
                  {item.quantity} × {item.item_name}
                </div>
                {item.specialInstructions && (
                  <div className="text-sm text-gray-500 mt-1">
                    Note: {item.specialInstructions}
                  </div>
                )}
              </div>
              <div className="text-right font-semibold text-base">
                {formatCurrency(item.price * item.quantity, venueCurrency)}
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm font-medium text-gray-900 mb-2">Special Instructions</div>
            <div className="text-sm text-gray-600">{order.notes}</div>
          </div>
        )}

        {/* Timestamps */}
        <div className="text-xs text-gray-500 mb-6">
          <div>Created: {new Date(order.created_at).toLocaleString('en-GB')}</div>
          <div>Updated: {new Date(order.updated_at).toLocaleString('en-GB')}</div>
        </div>

        {/* Primary Action Button */}
        {primaryAction && (
          <Button
            onClick={() => handleAction(primaryAction.onClick)}
            disabled={updating}
            className="w-full"
            variant="default"
          >
            {updating ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              primaryAction.label
            )}
          </Button>
        )}

        {/* Cancel Button (only for non-terminal states) */}
        {!['CANCELLED','REFUNDED','EXPIRED'].includes(order.order_status) && (
          <Button
            onClick={() => handleAction(() => setOrderStatus(order.id, 'CANCELLED'))}
            disabled={updating}
            className="w-full mt-2"
            variant="outline"
          >
            Cancel Order
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
