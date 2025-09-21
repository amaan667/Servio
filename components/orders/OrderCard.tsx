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
      const label = order.table_label || `Table ${order.table_id || '—'}`;
      if (!order.table_label && order.table_id) {
        console.warn(`[OrderCard] Missing table_label for table order ${order.id}`);
      }
      return {
        icon: <MapPin className="h-3 w-3" />,
        label,
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    } else {
      return {
        icon: <Hash className="h-3 w-3" />,
        label: order.counter_label || 'Counter A',
        badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
      };
    }
  };

  const { icon, label, badgeColor } = getEntityDisplay();

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

  // Order action buttons
  const renderActions = () => {
    if (!showActions || !venueId) return null;

    const isPaid = order.payment.status === 'paid';
    const isCompleted = order.order_status === 'completed';
    const showUnpaid = shouldShowUnpaidChip(order);

    if (showUnpaid && !isPaid) {
      // Show payment actions
      return (
        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              <span className="font-medium">Payment Required:</span> {formatCurrency(order.total_amount, order.currency)}
            </div>
            <div className="flex gap-2">
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

    if (isPaid && !isCompleted) {
      // Show completion action
      return (
        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-green-600">
              <span className="font-medium">Payment Complete</span>
            </div>
            <Button
              size="sm"
              onClick={() => handlePayment('till')} // Reuse to mark complete
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Mark Complete
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card 
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow ${className}`}
      onMouseEnter={() => setShowHoverRemove(true)}
      onMouseLeave={() => setShowHoverRemove(false)}
    >
      <CardContent className="px-4 py-3 md:px-5 md:py-4">
        {/* Grid Layout */}
        <div className="grid grid-cols-6 md:grid-cols-12 gap-3 md:gap-4 items-center">
          
          {/* Header Section - Left Aligned */}
          <div className="col-span-4 md:col-span-6 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {/* Order Short ID Chip */}
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                #{order.short_id}
              </Badge>
              
              {/* Order Time */}
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                {formatOrderTime(order.placed_at)}
              </div>
            </div>

            {/* Entity Badge */}
            <div className="flex items-center gap-2 mb-2">
              <Badge className={`inline-flex items-center text-xs px-2 py-0.5 ${badgeColor}`}>
                {icon}
                <span className="ml-1">{label}</span>
              </Badge>
            </div>

            {/* Status Chips */}
            <div className="flex items-center gap-2 mb-2">
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

          {/* Meta Section - Center */}
          <div className="col-span-2 md:col-span-4 min-w-0">
            {/* Customer Info */}
            {order.customer?.name && (
              <div className="mb-2">
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                  <User className="h-3 w-3" />
                  <span>Customer</span>
                </div>
                <div className="font-medium text-sm truncate">{order.customer.name}</div>
                {order.customer.phone && (
                  <div className="text-xs text-slate-500 truncate">{order.customer.phone}</div>
                )}
              </div>
            )}

            {/* Items Preview */}
            {order.items_preview && (
              <div className="mb-2">
                <div className="text-xs text-slate-500 mb-1">Items</div>
                <div className="text-sm text-slate-700 line-clamp-2">{order.items_preview}</div>
              </div>
            )}
          </div>

          {/* Footer - Right Aligned */}
          <div className="col-span-6 md:col-span-2 md:justify-self-end">
            <div className="flex items-center justify-between md:flex-col md:items-end gap-2">
              {/* Total Amount */}
              <div className="text-right">
                <div className="text-lg font-semibold">
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
        </div>

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
