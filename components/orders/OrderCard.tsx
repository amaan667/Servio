'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  User, 
  Hash,
  MapPin,
  QrCode,
  Receipt,
  CreditCard,
  CheckCircle,
  X,
  Split,
  Play,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { OrderForCard } from '@/types/orders';
import { deriveEntityKind, shouldShowUnpaidChip } from '@/lib/orders/entity-types';
import { OrderStatusChip, PaymentStatusChip } from '@/components/ui/chips';
import { formatCurrency, formatOrderTime } from '@/lib/orders/mapOrderToCardData';

interface OrderCardProps {
  order: OrderForCard;
  variant?: 'table' | 'counter' | 'auto';
  venueId?: string;
  showActions?: boolean;
  onActionComplete?: () => void;
  className?: string;
}

export function OrderCard({ 
  order, 
  variant = 'auto', 
  venueId,
  showActions = true,
  onActionComplete,
  className = ''
}: OrderCardProps) {
  const [showHoverRemove, setShowHoverRemove] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Determine variant automatically if not specified
  const finalVariant = variant === 'auto' 
    ? (deriveEntityKind(order) === 'table' ? 'table' : 'counter')
    : variant;

  const isTableVariant = finalVariant === 'table';

  // Get appropriate label and icon
  const getEntityDisplay = () => {
    if (isTableVariant) {
      // Debug logging to see what data we have
      console.log(`[OrderCard DEBUG] Table order ${order.id}:`, {
        table_label: order.table_label,
        table_id: order.table_id,
        entityKind: deriveEntityKind(order)
      });
      
      const label = order.table_label || 'Table Order';
      if (!order.table_label) {
        console.warn(`[OrderCard] Missing table_label for table order ${order.id}`);
      }
      return {
        icon: <MapPin className="h-4 w-4" />,
        label,
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        type: 'Table Order',
      };
    } else {
      return {
        icon: <Hash className="h-4 w-4" />,
        label: order.counter_label || 'Counter A',
        badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
        type: 'Counter Order',
      };
    }
  };

  const { icon, label, badgeColor, type } = getEntityDisplay();

  // Handle order actions
  const handleRemoveOrder = async () => {
    if (!venueId) return;
    
    try {
      setIsProcessing(true);
      const response = await fetch('/api/orders/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: order.id,
          venue_id: venueId,
        }),
      });

      if (!response.ok) throw new Error('Failed to delete order');
      onActionComplete?.();
    } catch (error) {
      console.error('Error removing order:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async (paymentMethod: 'till' | 'card') => {
    if (!venueId) return;
    
    try {
      setIsProcessing(true);
      const response = await fetch('/api/orders/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId: order.id,
          venue_id: venueId,
          payment_method: paymentMethod,
          payment_status: 'PAID'
        }),
      });

      if (!response.ok) throw new Error('Failed to process payment');
      onActionComplete?.();
    } catch (error) {
      console.error('Error processing payment:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!venueId) return;
    
    console.log('[OrderCard DEBUG] Starting status update:', {
      orderId: order.id,
      currentStatus: order.order_status,
      newStatus: newStatus,
      venueId: venueId
    });
    
    try {
      setIsProcessing(true);
      const response = await fetch('/api/orders/set-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          status: newStatus
        }),
      });

      console.log('[OrderCard DEBUG] API response:', {
        status: response.status,
        ok: response.ok,
        orderId: order.id
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OrderCard DEBUG] API error response:', errorText);
        throw new Error('Failed to update order status');
      }
      
      console.log('[OrderCard DEBUG] Status update successful, calling onActionComplete');
      await onActionComplete?.();
    } catch (error) {
      console.error('[OrderCard DEBUG] Error updating order status:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Order action buttons
  const renderActions = () => {
    if (!showActions || !venueId) return null;

    const isPaid = order.payment.status === 'paid';
    const isCompleted = order.order_status === 'completed';
    const showUnpaid = shouldShowUnpaidChip(order);

    if (showUnpaid && !isPaid) {
      // Show payment actions for till/later orders
      return (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              <span className="font-medium">Payment Required:</span> {formatCurrency(order.total_amount, order.currency)}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePayment('till')}
                disabled={isProcessing}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Till Payment
              </Button>
              <Button
                size="sm"
                onClick={() => handlePayment('card')}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Card Payment
              </Button>
              {isTableVariant && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {/* TODO: Implement bill splitting */}}
                  disabled={isProcessing}
                  className="text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  <Split className="h-4 w-4 mr-1" />
                  Split Bill
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Show status update actions for all non-completed orders (regardless of payment status)
    if (!isCompleted) {
      const getNextStatus = () => {
        switch (order.order_status) {
          case 'placed': return 'IN_PREP';
          case 'preparing': return 'READY';
          case 'ready': return 'COMPLETED';
          case 'served': return 'COMPLETED';
          default: return 'COMPLETED';
        }
      };

      const getStatusLabel = () => {
        switch (order.order_status) {
          case 'placed': return 'Start Preparing';
          case 'preparing': return 'Mark as Ready';
          case 'ready': return 'Complete Order';
          case 'served': return 'Complete Order';
          default: return 'Complete Order';
        }
      };

      const getStatusIcon = () => {
        switch (order.order_status) {
          case 'placed': return <Play className="h-4 w-4 mr-1" />;
          case 'preparing': return <CheckCircle className="h-4 w-4 mr-1" />;
          case 'ready': return <CheckCircle className="h-4 w-4 mr-1" />;
          case 'served': return <CheckCircle className="h-4 w-4 mr-1" />;
          default: return <CheckCircle className="h-4 w-4 mr-1" />;
        }
      };

      const getStatusMessage = () => {
        if (isPaid) {
          return "Paid - Ready for next step";
        } else {
          // Show payment status based on payment mode
          switch (order.payment.mode) {
            case 'online':
              return "Paid - Ready for next step";
            case 'pay_later':
              return "Paying Later - Ready for next step";
            case 'pay_at_till':
              return "Paying at Till - Ready for next step";
            default:
              return "Order Management - Update Status";
          }
        }
      };

      return (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className={`text-sm ${isPaid ? 'text-blue-600' : 'text-orange-600'}`}>
              <span className="font-medium">{getStatusMessage()}</span>
            </div>
            <Button
              size="sm"
              onClick={() => handleStatusUpdate(getNextStatus())}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {getStatusIcon()}
              {getStatusLabel()}
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card 
      className={`rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow ${className}`}
      onMouseEnter={() => setShowHoverRemove(true)}
      onMouseLeave={() => setShowHoverRemove(false)}
    >
      <CardContent className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            {/* Order ID and Time */}
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="outline" className="text-sm font-semibold px-3 py-1">
                #{order.short_id}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <Clock className="h-4 w-4" />
                {formatOrderTime(order.placed_at)}
              </div>
            </div>

            {/* Entity Badge and Status */}
            <div className="flex items-center gap-3 mb-4">
              <Badge className={`inline-flex items-center text-sm px-3 py-1.5 ${badgeColor}`}>
                {icon}
                <span className="ml-2 font-medium">{label}</span>
                <span className="ml-2 text-xs opacity-75">({type})</span>
              </Badge>
              
              {/* Status Chips */}
              <div className="flex items-center gap-2">
                <OrderStatusChip status={order.order_status} />
                {shouldShowUnpaidChip(order) && (
                  <PaymentStatusChip status="unpaid" />
                )}
                {order.payment.status === 'paid' && (
                  <PaymentStatusChip status="paid" />
                )}
                {order.payment.status === 'failed' && (
                  <PaymentStatusChip status="failed" />
                )}
                {order.payment.status === 'refunded' && (
                  <PaymentStatusChip status="refunded" />
                )}
              </div>
            </div>
          </div>

          {/* Total Amount and Remove Button */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(order.total_amount, order.currency)}
              </div>
            </div>
            
            {/* Remove Button - On Hover */}
            {showActions && venueId && (
              <div className={`transition-opacity duration-200 ${showHoverRemove ? 'opacity-100' : 'opacity-0'}`}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={handleRemoveOrder}
                        disabled={isProcessing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Remove Order</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
        </div>

        {/* Customer Info */}
        {order.customer?.name && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-600" />
              <span className="font-semibold text-slate-900">{order.customer.name}</span>
              {order.customer.phone && (
                <span className="text-sm text-slate-600 ml-2">• {order.customer.phone}</span>
              )}
            </div>
          </div>
        )}

        {/* Items Preview */}
        {order.items_preview && (
          <div className="mb-4">
            <div className="text-sm font-medium text-slate-700 mb-2">Order Items</div>
            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {order.items_preview}
            </div>
          </div>
        )}

        {/* Action Section */}
        {renderActions()}
      </CardContent>
    </Card>
  );
}

// Convenience wrapper that automatically determines variant
export function AutoOrderCard(props: Omit<OrderCardProps, 'variant'>) {
  return <OrderCard {...props} variant="auto" />;
}
