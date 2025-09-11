'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Receipt,
  User,
  QrCode
} from 'lucide-react';
import { TableOrder } from '@/hooks/useTableOrders';
import { calculateOrderTotal, formatPrice, normalizePrice } from '@/lib/pricing-utils';

interface TableOrderCardProps {
  order: TableOrder;
  venueId: string;
  onActionComplete?: () => void;
}

export function TableOrderCard({ order, venueId, onActionComplete }: TableOrderCardProps) {

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
    <Card className="w-full shadow-sm hover:shadow-md transition-all duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-lg text-gray-900">
                {order.table_label || `Table ${order.table_number}`}
              </h3>
              <Badge variant="secondary" className="text-xs px-2 py-1 bg-blue-50 text-blue-700">
                <QrCode className="h-3 w-3 mr-1" />
                QR Order
              </Badge>
            </div>
            <div className="text-sm text-gray-500">{formatTime(order.created_at)}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">£{getTotalAmount()}</div>
          </div>
        </div>

        {/* Customer Info */}
        {order.customer_name && (
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">{order.customer_name}</span>
          </div>
        )}

        {/* Status Badges */}
        <div className="flex items-center gap-3 mb-6">
          <Badge className={`${getStatusColor(order.order_status)} text-xs font-semibold px-3 py-1.5 rounded-full`}>
            {order.order_status.replace('_', ' ')}
          </Badge>
          <Badge className={`${getPaymentStatusColor(order.payment_status)} text-xs font-semibold px-3 py-1.5 rounded-full`}>
            {order.payment_status}
          </Badge>
        </div>

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Order Items</h4>
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-xs font-bold text-gray-600 border border-gray-200">
                      {item.quantity}
                    </div>
                    <span className="font-medium text-gray-900">{item.item_name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">£{formatPrice(normalizePrice(item.price))}</span>
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
