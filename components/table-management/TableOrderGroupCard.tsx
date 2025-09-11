'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Receipt,
  User,
  QrCode,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import { TableOrder } from '@/hooks/useTableOrders';
import { calculateOrderTotal, formatPrice, normalizePrice } from '@/lib/pricing-utils';

interface TableOrderGroupCardProps {
  tableLabel: string;
  orders: TableOrder[];
  venueId: string;
  onActionComplete?: () => void;
}

export function TableOrderGroupCard({ tableLabel, orders, venueId, onActionComplete }: TableOrderGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLACED': return 'bg-yellow-100 text-yellow-800';
      case 'IN_PREP': return 'bg-blue-100 text-blue-800';
      case 'READY': return 'bg-green-100 text-green-800';
      case 'SERVING': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'UNPAID': return 'bg-red-100 text-red-800';
      case 'TILL': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTotalAmount = (order: TableOrder) => {
    const total = calculateOrderTotal({ total_amount: order.total_amount, items: order.items });
    return formatPrice(total);
  };

  const getTotalAmountForAllOrders = () => {
    const total = orders.reduce((sum, order) => {
      const orderTotal = calculateOrderTotal({ total_amount: order.total_amount, items: order.items });
      return sum + orderTotal;
    }, 0);
    return formatPrice(total);
  };

  const getLatestOrderTime = () => {
    const latestOrder = orders.reduce((latest, order) => 
      new Date(order.created_at) > new Date(latest.created_at) ? order : latest
    );
    return formatTime(latestOrder.created_at);
  };

  const getOrderStatusCounts = () => {
    const counts = orders.reduce((acc, order) => {
      acc[order.order_status] = (acc[order.order_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return counts;
  };

  const statusCounts = getOrderStatusCounts();
  const hasMultipleOrders = orders.length > 1;

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{tableLabel}</h3>
            <Badge variant="secondary" className="text-xs">
              <QrCode className="h-3 w-3 mr-1" />
              QR Table
            </Badge>
            {hasMultipleOrders && (
              <Badge variant="outline" className="text-xs">
                {orders.length} orders
              </Badge>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">{getLatestOrderTime()}</div>
            <div className="font-bold text-lg">£{getTotalAmountForAllOrders()}</div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {Object.entries(statusCounts).map(([status, count]) => (
            <Badge key={status} className={getStatusColor(status)}>
              {count > 1 ? `${count}x ` : ''}{status.replace('_', ' ')}
            </Badge>
          ))}
        </div>

        {/* Expandable Orders */}
        {hasMultipleOrders && (
          <div className="mb-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide individual orders
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show {orders.length} individual orders
                </>
              )}
            </button>
          </div>
        )}

        {/* Individual Orders */}
        {(isExpanded || !hasMultipleOrders) && (
          <div className="space-y-3">
            {orders.map((order, index) => (
              <div key={order.id} className="border-l-2 border-gray-200 pl-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {hasMultipleOrders && (
                      <span className="text-xs text-gray-500">Order {index + 1}</span>
                    )}
                    <span className="text-sm text-gray-500">{formatTime(order.created_at)}</span>
                  </div>
                  <span className="text-sm font-medium">£{getTotalAmount(order)}</span>
                </div>

                {/* Customer Info */}
                {order.customer_name && (
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-3 w-3 text-gray-500" />
                    <span className="text-xs text-gray-600">{order.customer_name}</span>
                  </div>
                )}

                {/* Status Badges */}
                <div className="flex gap-1 mb-2">
                  <Badge className={`text-xs ${getStatusColor(order.order_status)}`}>
                    {order.order_status.replace('_', ' ')}
                  </Badge>
                  <Badge className={`text-xs ${getPaymentStatusColor(order.payment_status)}`}>
                    {order.payment_status}
                  </Badge>
                </div>

                {/* Order Items */}
                {order.items && order.items.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-gray-700 mb-1">Items:</div>
                    <div className="space-y-1">
                      {order.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex justify-between text-xs">
                          <span>{item.quantity}x {item.item_name}</span>
                          <span>£{formatPrice(normalizePrice(item.price))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons removed - order management is now handled on the live orders page */}
      </CardContent>
    </Card>
  );
}
