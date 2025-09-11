'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Receipt,
  User
} from 'lucide-react';
import { StatusPill } from './StatusPill';
import { CounterOrder } from '@/hooks/useCounterOrders';
import { calculateOrderTotal, formatPrice, normalizePrice } from '@/lib/pricing-utils';

interface CounterOrderCardProps {
  order: CounterOrder;
  venueId: string;
  onActionComplete?: () => void;
}

export function CounterOrderCard({ order, venueId, onActionComplete }: CounterOrderCardProps) {

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

  const getTotalAmount = () => {
    // Use the standardized pricing calculation
    const total = calculateOrderTotal({ total_amount: order.total_amount, items: order.items });
    return formatPrice(total);
  };


  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">Counter {order.table_number}</h3>
            <Badge variant="secondary" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              Counter Order
            </Badge>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">{formatTime(order.created_at)}</div>
            <div className="font-bold text-lg">£{getTotalAmount()}</div>
          </div>
        </div>

        {/* Customer Info */}
        {order.customer_name && (
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">{order.customer_name}</span>
          </div>
        )}

        {/* Status Badges */}
        <div className="flex gap-2 mb-3">
          <Badge className={getStatusColor(order.order_status)}>
            {order.order_status.replace('_', ' ')}
          </Badge>
          <Badge className={getPaymentStatusColor(order.payment_status)}>
            {order.payment_status}
          </Badge>
        </div>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <div className="mb-3">
            <div className="text-sm font-medium text-gray-700 mb-1">Items:</div>
            <div className="space-y-1">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.item_name}</span>
                  <span>£{formatPrice(normalizePrice(item.price))}</span>
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
