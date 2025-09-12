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
    
    if (uniquePaymentStatuses.length === 1 && uniquePaymentStatuses[0]) {
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
    <Card className="w-full border-2 border-gray-200 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md">
      <CardContent className="p-6">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <div className="text-2xl font-bold text-gray-900">{tableLabel}</div>
              <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                <QrCode className="h-3 w-3 mr-1" />
                QR Table
              </Badge>
              {hasMultipleOrders && (
                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                  {orders.length} orders
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-600">
              Latest: {getLatestOrderTime()}
              {hasMultipleOrders && (
                <span className="ml-2">• {orders.length} active orders</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900 mb-1">£{getTotalAmountForAllOrders()}</div>
            <div className="text-sm text-gray-500 font-medium">Table Total</div>
          </div>
        </div>

        {/* Status Section */}
        <div className="flex gap-3 mb-6">
          <Badge className={`${getStatusColor(overallStatus)} text-sm font-semibold px-4 py-2 rounded-full`}>
            {overallStatus.replace('_', ' ').toLowerCase()}
          </Badge>
          <Badge className={`${getPaymentStatusColor(overallPaymentStatus)} text-sm font-semibold px-4 py-2 rounded-full`}>
            {overallPaymentStatus.toLowerCase()}
          </Badge>
        </div>

        {/* Expand/Collapse Button for Multiple Orders */}
        {hasMultipleOrders && (
          <div className="mb-4">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-all duration-200 w-full text-left"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Hide individual orders</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Show {orders.length} individual orders</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Individual Orders */}
        {(isExpanded || !hasMultipleOrders) && (
          <div className="space-y-6">
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Individual Orders</h4>
              {orders.map((order, index) => (
                <div key={order.id} className="border-2 border-gray-200 rounded-xl p-5 bg-white shadow-sm mb-4">
                  {/* Order Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-sm font-bold text-blue-700 border-2 border-blue-200">
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-base font-semibold text-gray-900">
                          {formatTime(order.created_at)}
                        </div>
                        {hasMultipleOrders && (
                          <div className="text-xs text-gray-500 font-medium">
                            Order #{order.id.slice(-6).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">£{getTotalAmount(order)}</div>
                      <div className="text-xs text-gray-500">Order Total</div>
                    </div>
                  </div>

                  {/* Customer Info */}
                  {order.customer_name && (
                    <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                      <User className="h-5 w-5 text-gray-500" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">{order.customer_name}</span>
                        {order.customer_phone && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span className="text-sm text-gray-600">{order.customer_phone}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Status Badges */}
                  <div className="flex gap-3 mb-4">
                    <Badge className={`${getStatusColor(order.order_status)} text-sm font-semibold px-3 py-1.5 rounded-full`}>
                      {order.order_status.replace('_', ' ').toLowerCase()}
                    </Badge>
                    <Badge className={`${getPaymentStatusColor(order.payment_status)} text-sm font-semibold px-3 py-1.5 rounded-full`}>
                      {order.payment_status.toLowerCase()}
                    </Badge>
                  </div>

                  {/* Order Items */}
                  {order.items && order.items.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-gray-700 mb-3">Order Items</div>
                      {order.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex items-center gap-4">
                            <span className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm font-bold text-gray-700 border-2 border-gray-200">
                              {item.quantity}
                            </span>
                            <span className="text-gray-900 font-medium text-base">{item.item_name}</span>
                          </div>
                          <span className="font-bold text-gray-900 text-lg">£{formatPrice(normalizePrice(item.price))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons removed - order management is now handled on the live orders page */}
      </CardContent>
    </Card>
  );
}
