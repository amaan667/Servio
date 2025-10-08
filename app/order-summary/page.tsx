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
  counterNumber?: string;
  orderType?: string;
  orderLocation?: string;
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
  isDemo?: boolean; // Add demo flag
}

export default function OrderSummaryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderData, setOrderData] = useState<PendingOrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    // Get order data from localStorage
    const storedData = localStorage.getItem('servio-pending-order');
    
    console.log('[ORDER SUMMARY DEBUG] Loading order data:', storedData);
    
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        console.log('[ORDER SUMMARY DEBUG] Parsed data:', data);
        console.log('[ORDER SUMMARY DEBUG] Is demo?', data.isDemo, data.venueId === 'demo-cafe');
        setOrderData(data);
      } catch (error) {
        console.error('Error parsing stored order data:', error);
        router.push('/order');
      }
    } else {
      console.log('[ORDER SUMMARY DEBUG] No stored data, redirecting to order page');
      router.push('/order');
    }
    setLoading(false);
  }, [router]);

  const handlePayNow = async () => {
    console.log('[ORDER SUMMARY DEBUG] ===== handlePayNow STARTED =====');
    console.log('[ORDER SUMMARY DEBUG] orderData:', orderData);
    
    if (!orderData) {
      console.error('[ORDER SUMMARY DEBUG] No orderData found!');
      return;
    }
    
    // Check if this is a demo order - never redirect to Stripe for demos
    const isDemo = orderData.isDemo || orderData.venueId === 'demo-cafe';
    
    console.log('[ORDER SUMMARY DEBUG] handlePayNow - isDemo:', isDemo);
    console.log('[ORDER SUMMARY DEBUG] orderData.isDemo:', orderData.isDemo);
    console.log('[ORDER SUMMARY DEBUG] orderData.venueId:', orderData.venueId);
    
    if (isDemo) {
      console.log('[ORDER SUMMARY DEBUG] ===== DEMO ORDER DETECTED =====');
      // For demo orders, create demo order data and redirect to payment success page
      const demoOrderId = `demo-${Date.now()}`;
      console.log('[ORDER SUMMARY DEBUG] Generated demoOrderId:', demoOrderId);
      
      const demoOrderData = {
        id: demoOrderId,
        venue_id: orderData.venueId,
        venue_name: orderData.venueName,
        table_number: orderData.tableNumber,
        order_status: 'PLACED',
        payment_status: 'PAID',
        payment_method: 'demo',
        customer_name: orderData.customerName,
        customer_phone: orderData.customerPhone,
        total_amount: orderData.total,
        items: orderData.cart.map((item) => ({
          item_name: item.name,
          price: item.price,
          quantity: item.quantity,
          special_instructions: item.specialInstructions || null,
        })),
        created_at: new Date().toISOString(),
      };

      console.log('[ORDER SUMMARY DEBUG] ===== CREATED DEMO ORDER DATA =====');
      console.log('[ORDER SUMMARY DEBUG] demoOrderData object:', demoOrderData);
      console.log('[ORDER SUMMARY DEBUG] demoOrderData JSON string:', JSON.stringify(demoOrderData));
      
      // Check sessionStorage before setting
      console.log('[ORDER SUMMARY DEBUG] sessionStorage before setItem:', sessionStorage.getItem('demo-order-data'));
      
      // Store demo order data for the success page
      try {
        console.log('[ORDER SUMMARY DEBUG] ===== STORING TO SESSIONSTORAGE =====');
        sessionStorage.setItem('demo-order-data', JSON.stringify(demoOrderData));
        console.log('[ORDER SUMMARY DEBUG] sessionStorage.setItem completed successfully');
        
        // Verify storage immediately
        const stored = sessionStorage.getItem('demo-order-data');
        console.log('[ORDER SUMMARY DEBUG] ===== VERIFICATION =====');
        console.log('[ORDER SUMMARY DEBUG] Stored data:', stored);
        console.log('[ORDER SUMMARY DEBUG] Stored data parsed:', JSON.parse(stored || '{}'));
        
        // Check all sessionStorage keys
        console.log('[ORDER SUMMARY DEBUG] All sessionStorage keys:', Object.keys(sessionStorage));
        
        // Small delay to ensure storage is complete
        console.log('[ORDER SUMMARY DEBUG] ===== PREPARING REDIRECT =====');
        const redirectUrl = `/payment/success?orderId=${demoOrderId}&demo=1&paymentMethod=demo`;
        console.log('[ORDER SUMMARY DEBUG] Redirect URL:', redirectUrl);
        
        setTimeout(() => {
          console.log('[ORDER SUMMARY DEBUG] ===== EXECUTING REDIRECT =====');
          console.log('[ORDER SUMMARY DEBUG] Final sessionStorage check before redirect:', sessionStorage.getItem('demo-order-data'));
          window.location.href = redirectUrl;
        }, 100);
      } catch (error) {
        console.error('[ORDER SUMMARY DEBUG] ===== STORAGE ERROR =====');
        console.error('[ORDER SUMMARY DEBUG] Error storing demo order data:', error);
        console.error('[ORDER SUMMARY DEBUG] Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
        // Fallback: redirect anyway and let the success page handle the error
        window.location.href = `/payment/success?orderId=${demoOrderId}&demo=1&paymentMethod=demo`;
      }
      return;
    }
    
    setLoading(true);
    try {
      // First, create the order in the database
      
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
        total_amount: orderData.total,
        order_status: 'PLACED',
        payment_status: 'UNPAID',
        source: orderData.orderType === 'counter' ? 'counter' : 'qr', // Set source based on order type
        notes: 'Order placed - payment pending'
      };

      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }

      const orderResult = await orderResponse.json();
      
      if (!orderResult.order?.id) {
        console.error('[ORDER SUMMARY DEBUG] ERROR: No order ID in response:', orderResult);
        console.error('[ORDER SUMMARY DEBUG] Full response structure:', JSON.stringify(orderResult, null, 2));
        throw new Error('Order was created but no order ID was returned');
      }

      // Now create Stripe checkout session
      const checkoutResponse = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: orderResult.order.id, 
          total: orderData.total, 
          currency: 'GBP' 
        }),
      });
      
      const { url, sessionId, error: checkoutErr } = await checkoutResponse.json();
      if (!checkoutResponse.ok || !(url || sessionId)) {
        throw new Error(checkoutErr || 'Checkout failed');
      }

      // Redirect to Stripe checkout
      if (url) {
        window.location.assign(url);
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('[ORDER SUMMARY DEBUG] Payment error:', error);
      alert(error instanceof Error ? error.message : 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayLater = async () => {
    if (!orderData) return;

    // Check if this is a demo order
    const isDemo = orderData.isDemo || orderData.venueId === 'demo-cafe';
    
    console.log('[ORDER SUMMARY DEBUG] handlePayLater - isDemo:', isDemo);
    
    if (isDemo) {
      console.log('[ORDER SUMMARY DEBUG] Demo order detected - redirecting to payment success');
      // For demo orders, create demo order data and redirect to payment success page
      const demoOrderId = `demo-${Date.now()}`;
      const demoOrderData = {
        id: demoOrderId,
        venue_id: orderData.venueId,
        venue_name: orderData.venueName,
        table_number: orderData.tableNumber,
        order_status: 'PLACED',
        payment_status: 'PAID',
        payment_method: 'later',
        customer_name: orderData.customerName,
        customer_phone: orderData.customerPhone,
        total_amount: orderData.total,
        items: orderData.cart.map((item) => ({
          item_name: item.name,
          price: item.price,
          quantity: item.quantity,
          special_instructions: item.specialInstructions || null,
        })),
        created_at: new Date().toISOString(),
      };

      // Store demo order data for the success page
      console.log('[ORDER SUMMARY DEBUG] Storing demo order data (pay later):', demoOrderData);
      try {
        sessionStorage.setItem('demo-order-data', JSON.stringify(demoOrderData));
        
        // Verify storage
        const stored = sessionStorage.getItem('demo-order-data');
        console.log('[ORDER SUMMARY DEBUG] Verified storage (pay later):', stored);
        
        // Small delay to ensure storage is complete
        setTimeout(() => {
          window.location.href = `/payment/success?orderId=${demoOrderId}&demo=1&paymentMethod=later`;
        }, 100);
      } catch (error) {
        console.error('[ORDER SUMMARY DEBUG] Error storing demo order data (pay later):', error);
        // Fallback: redirect anyway and let the success page handle the error
        window.location.href = `/payment/success?orderId=${demoOrderId}&demo=1&paymentMethod=later`;
      }
      return;
    }

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
      setOrderPlaced(true);
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
    const param = orderData.orderType === 'counter' ? 'counter' : 'table';
    const value = orderData.orderLocation || orderData.tableNumber;
    router.push(`/order?venue=${orderData.venueId}&${param}=${value}`);
  };

  const handleBackToOrder = () => {
    if (!orderData) return;
    const param = orderData.orderType === 'counter' ? 'counter' : 'table';
    const value = orderData.orderLocation || orderData.tableNumber;
    router.push(`/order?venue=${orderData.venueId}&${param}=${value}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900">Loading order summary...</p>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No order found</h2>
          <p className="text-gray-900 mb-4">Please start a new order.</p>
          <Button onClick={() => router.push('/order')}>
            Start New Order
          </Button>
        </div>
      </div>
    );
  }

  // Check if this is a demo order
  const isDemo = orderData?.isDemo || orderData?.venueId === 'demo-cafe';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Demo Mode Banner */}
      {isDemo && (
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-3 px-4 shadow-md">
          <div className="max-w-4xl mx-auto flex items-center justify-center">
            <div className="flex items-center space-x-3">
              <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">💡 Demo Mode — This is a simulated order experience</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={800}
                height={250}
                className="h-12 sm:h-14 md:h-16 lg:h-18 xl:h-20 w-auto"
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
          <div className={`w-16 h-16 ${orderPlaced && isDemo ? 'bg-green-100' : 'bg-blue-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            {orderPlaced && isDemo ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : (
              <Receipt className="w-8 h-8 text-blue-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {orderPlaced && isDemo ? 'Order Placed Successfully!' : 'Order Summary'}
          </h1>
          <p className="text-gray-900">
            {orderPlaced && isDemo 
              ? 'Your demo order has been placed. In a real scenario, this would go to the kitchen.' 
              : 'Review your order and choose how to pay'}
          </p>
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
                    <span className="text-gray-900">Venue:</span>
                    <span className="font-medium">{orderData.venueName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-900">{orderData.orderType === 'counter' ? 'Counter:' : 'Table:'}</span>
                    <span className="font-medium">{orderData.orderLocation || orderData.tableNumber}</span>
                  </div>
                  
                  {/* Customer Information - Highlighted */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex justify-between">
                      <span className="text-blue-700 font-medium">Customer Name:</span>
                      <span className="font-semibold text-blue-900">{orderData.customerName}</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-blue-700 font-medium">Phone Number:</span>
                      <span className="font-semibold text-blue-900">{orderData.customerPhone}</span>
                    </div>
                  </div>
                  
                  {orderData.orderId && (
                    <div className="flex justify-between">
                      <span className="text-gray-900">Order ID:</span>
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
                        <p className="text-sm text-gray-900">Qty: {item.quantity}</p>
                        {item.specialInstructions && (
                          <p className="text-xs text-gray-900">Note: {item.specialInstructions}</p>
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
                  {isDemo && orderPlaced ? (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                      Demo Order Complete
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      Payment Options
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isDemo && orderPlaced ? (
                  <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50">
                    <div className="flex items-center mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <h3 className="font-semibold text-green-900">Demo Order Placed!</h3>
                    </div>
                    <p className="text-sm text-green-700 mb-4">
                      This is a simulated order. In a real scenario, your order would be sent to the kitchen and you could track its status.
                    </p>
                    <div className="space-y-2">
                      <Button 
                        onClick={handleBackToOrder}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Continue Exploring Menu
                      </Button>
                      <Button 
                        onClick={() => router.push('/dashboard')}
                        variant="outline"
                        className="w-full"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                      </Button>
                    </div>
                  </div>
                ) : !orderData.orderId ? (
                  <>
                    <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                      <h3 className="font-semibold text-blue-900 mb-2">{isDemo ? 'Simulate Payment' : 'Pay Now'}</h3>
                      <p className="text-sm text-blue-700 mb-4">
                        {isDemo 
                          ? 'Experience the payment flow in demo mode (no actual payment required).' 
                          : 'Complete your payment immediately using our secure payment system.'}
                      </p>
                      <Button 
                        onClick={handlePayNow}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            {isDemo ? 'Simulate Payment' : `Pay £${orderData.total.toFixed(2)} Now`}
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50">
                      <h3 className="font-semibold text-green-900 mb-2">{isDemo ? 'Simulate Pay Later' : 'Pay Later'}</h3>
                      <p className="text-sm text-green-700 mb-4">
                        {isDemo 
                          ? 'See how deferred payment works in a real restaurant scenario.' 
                          : 'Place your order now and pay when you\'re ready. You can add more items to your table.'}
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
                            {isDemo ? 'Simulate Pay Later' : 'Pay Later'}
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
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 mr-2" />
                            Pay Now
                          </>
                        )}
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
                  Add More Items to {orderData?.orderType === 'counter' ? 'Counter' : 'Table'}
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
                    <span className="text-sm text-gray-900">Order Status:</span>
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
