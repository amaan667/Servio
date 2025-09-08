'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ShoppingCart, 
  CreditCard, 
  Clock, 
  Plus, 
  CheckCircle,
  ArrowLeft,
  Receipt,
  Users
} from 'lucide-react';
import Image from 'next/image';

interface PendingOrderData {
  venueId: string;
  venueName: string;
  tableNumber: number;
  cart: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    specialInstructions?: string;
  }>;
  total: number;
  customerName: string;
  customerPhone: string;
  orderId?: string;
}

export default function OrderSummaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderData, setOrderData] = useState<PendingOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  useEffect(() => {
    // Get order data from localStorage
    const storedData = localStorage.getItem('servio-pending-order');
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        setOrderData(data);
      } catch (error) {
        console.error('Error parsing stored order data:', error);
        router.push('/order');
      }
    } else {
      router.push('/order');
    }
    setLoading(false);
  }, [router]);

  const handlePayNow = () => {
    if (!orderData) return;
    
    // Store order data for checkout
    localStorage.setItem('servio-checkout-data', JSON.stringify({
      ...orderData,
      cartId: `cart-${Date.now()}`,
    }));
    
    router.push('/checkout');
  };

  const handlePayLater = async () => {
    if (!orderData) return;

    try {
      setIsCreatingOrder(true);
      
      // Create order with UNPAID status
      const orderPayload = {
        venue_id: orderData.venueId,
        table_number: orderData.tableNumber,
        customer_name: orderData.customerName,
        customer_phone: orderData.customerPhone,
        items: orderData.cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          price: item.price,
          item_name: item.name,
          specialInstructions: item.specialInstructions || null
        })),
        total_amount: orderData.total, // Keep as pounds, not pence
        order_status: 'PLACED',
        payment_status: 'UNPAID',
        notes: 'Order placed - payment pending'
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      const result = await response.json();
      
      // Update order data with order ID
      const updatedOrderData = {
        ...orderData,
        orderId: result.order?.id
      };
      
      setOrderData(updatedOrderData);
      localStorage.setItem('servio-pending-order', JSON.stringify(updatedOrderData));
      
      // Clear checkout data since we're not going to checkout
      localStorage.removeItem('servio-checkout-data');
      
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleAddMoreItems = () => {
    if (!orderData) return;
    router.push(`/order?venue=${orderData.venueId}&table=${orderData.tableNumber}`);
  };

  const handleBackToOrder = () => {
    if (!orderData) return;
    router.push(`/order?venue=${orderData.venueId}&table=${orderData.tableNumber}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading order summary...</p>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No order found</h2>
          <p className="text-gray-600 mb-4">Please start a new order.</p>
          <Button onClick={() => router.push('/order')}>
            Start New Order
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={300}
                height={90}
                className="h-20 w-auto"
                priority
              />
            </div>
            <Button
              onClick={handleBackToOrder}
              variant="ghost"
              className="flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Menu
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Order Summary Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Summary</h1>
          <p className="text-gray-600">Review your order and choose how to pay</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Venue:</span>
                    <span className="font-medium">{orderData.venueName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Table:</span>
                    <span className="font-medium">{orderData.tableNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{orderData.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium">{orderData.customerPhone}</span>
                  </div>
                  {orderData.orderId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Order ID:</span>
                      <span className="font-medium">#{orderData.orderId.slice(-6)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orderData.cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                        {item.specialInstructions && (
                          <p className="text-xs text-gray-500">Note: {item.specialInstructions}</p>
                        )}
                      </div>
                      <span className="font-medium">£{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span>£{orderData.total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Options */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  Payment Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!orderData.orderId ? (
                  <>
                    <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                      <h3 className="font-semibold text-blue-900 mb-2">Pay Now</h3>
                      <p className="text-sm text-blue-700 mb-4">
                        Complete your payment immediately using our secure payment system.
                      </p>
                      <Button 
                        onClick={handlePayNow}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay £{orderData.total.toFixed(2)} Now
                      </Button>
                    </div>

                    <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50">
                      <h3 className="font-semibold text-green-900 mb-2">Pay Later</h3>
                      <p className="text-sm text-green-700 mb-4">
                        Place your order now and pay when you're ready. You can add more items to your table.
                      </p>
                      <Button 
                        onClick={handlePayLater}
                        disabled={isCreatingOrder}
                        variant="outline"
                        className="w-full border-green-300 text-green-700 hover:bg-green-100"
                      >
                        {isCreatingOrder ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                            Creating Order...
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 mr-2" />
                            Pay Later
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50">
                    <div className="flex items-center mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <h3 className="font-semibold text-green-900">Order Placed Successfully!</h3>
                    </div>
                    <p className="text-sm text-green-700 mb-4">
                      Your order has been placed and is ready for the kitchen. You can pay when you're ready.
                    </p>
                    <div className="space-y-2">
                      <Button 
                        onClick={handlePayNow}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Pay Now
                      </Button>
                      <Button 
                        onClick={handleAddMoreItems}
                        variant="outline"
                        className="w-full border-green-300 text-green-700 hover:bg-green-100"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add More Items
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={handleAddMoreItems}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add More Items to Table
                </Button>
                
                <Button 
                  onClick={handleBackToOrder}
                  variant="outline"
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Menu
                </Button>
              </CardContent>
            </Card>

            {/* Status Badge */}
            {orderData.orderId && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Order Status:</span>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      <Clock className="w-3 h-3 mr-1" />
                      Payment Pending
                    </Badge>
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
