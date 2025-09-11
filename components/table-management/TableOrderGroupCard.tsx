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
      case 'MIXED': return 'bg-purple-100 text-purple-800';
      case 'MIXED_READY': return 'bg-emerald-100 text-emerald-800';
      case 'MIXED_PREP': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'UNPAID': return 'bg-red-100 text-red-800';
      case 'TILL': return 'bg-blue-100 text-blue-800';
      case 'MIXED': return 'bg-amber-100 text-amber-800';
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

  const getOverallStatus = () => {
    const statuses = orders.map(order => order.order_status);
    const uniqueStatuses = [...new Set(statuses)];
    
    if (uniqueStatuses.length === 1) {
      return uniqueStatuses[0];
    } else if (uniqueStatuses.includes('READY')) {
      return 'MIXED_READY';
    } else if (uniqueStatuses.includes('IN_PREP')) {
      return 'MIXED_PREP';
    } else {
      return 'MIXED';
    }
  };

  const getOverallPaymentStatus = () => {
    const paymentStatuses = orders.map(order => order.payment_status).filter(Boolean);
    const uniquePaymentStatuses = [...new Set(paymentStatuses)];
    
    if (uniquePaymentStatuses.length === 1) {
      return uniquePaymentStatuses[0];
    } else {
      return 'MIXED';
    }
  };

  const statusCounts = getOrderStatusCounts();
  const overallStatus = getOverallStatus();
  const overallPaymentStatus = getOverallPaymentStatus();
  const hasMultipleOrders = orders.length > 1;

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-sm font-medium text-gray-500">{getLatestOrderTime()}</div>
              <div className="h-1 w-1 rounded-full bg-gray-300"></div>
              <div className="font-semibold text-gray-900 text-lg">{tableLabel}</div>
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
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900 mb-1">£{getTotalAmountForAllOrders()}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <Badge className={`${getStatusColor(overallStatus)} text-xs font-semibold px-3 py-1.5 rounded-full`}>
            {overallStatus.replace('_', ' ').toLowerCase()}
          </Badge>
          <Badge className={`${getPaymentStatusColor(overallPaymentStatus)} text-xs font-semibold px-3 py-1.5 rounded-full`}>
            {overallPaymentStatus.toLowerCase()}
          </Badge>
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
          <div className="space-y-4">
            {orders.map((order, index) => (
              <div key={order.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-600 border border-gray-200">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatTime(order.created_at)}
                      </div>
                      {hasMultipleOrders && (
                        <div className="text-xs text-gray-500">
                          Order #{order.id.slice(-6).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">£{getTotalAmount(order)}</div>
                  </div>
                </div>

                {/* Customer Info */}
                {order.customer_name && (
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">{order.customer_name}</span>
                  </div>
                )}

                {/* Status Badges */}
                <div className="flex gap-3 mb-3">
                  <Badge className={`${getStatusColor(order.order_status)} text-xs font-semibold px-2 py-1 rounded-full`}>
                    {order.order_status.replace('_', ' ').toLowerCase()}
                  </Badge>
                  <Badge className={`${getPaymentStatusColor(order.payment_status)} text-xs font-semibold px-2 py-1 rounded-full`}>
                    {order.payment_status.toLowerCase()}
                  </Badge>
                </div>

                {/* Order Items */}
                {order.items && order.items.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-600 mb-2">Items:</div>
                    {order.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-600 border border-gray-200">
                            {item.quantity}
                          </span>
                          <span className="text-gray-900">{item.item_name}</span>
                        </div>
                        <span className="font-medium text-gray-900">£{formatPrice(normalizePrice(item.price))}</span>
                      </div>
                    ))}
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
