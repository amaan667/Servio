"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ShoppingCart, CreditCard } from "lucide-react";

export default function TestCheckoutPage() {
  const router = useRouter();
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testDemoCheckout = () => {
    addResult("Starting demo checkout test...");
    
    // Simulate adding items to cart
    const demoCart = [
      { id: 'demo-1', name: 'Test Item 1', price: 1200, quantity: 1 },
      { id: 'demo-2', name: 'Test Item 2', price: 800, quantity: 2 },
    ];
    
    const orderData = {
      venue_id: 'demo-cafe',
      venueName: 'Demo Restaurant',
      table_number: 1,
      customer_name: 'Test Customer',
      customer_phone: '+1234567890',
      cart: demoCart,
      total: demoCart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      notes: 'Test order',
    };
    
    // Store in localStorage
    localStorage.setItem('pending-order-data', JSON.stringify(orderData));
    addResult("Order data stored in localStorage");
    
    // Navigate to checkout with demo mode
    router.push('/checkout?demo=1');
    addResult("Navigating to checkout page with demo mode");
  };

  const testRealCheckout = () => {
    addResult("Starting real checkout test...");
    
    // Simulate adding items to cart
    const demoCart = [
      { id: 'real-1', name: 'Real Item 1', price: 1500, quantity: 1 },
      { id: 'real-2', name: 'Real Item 2', price: 900, quantity: 1 },
    ];
    
    const orderData = {
      venue_id: 'test-venue',
      venueName: 'Test Restaurant',
      table_number: 5,
      customer_name: 'Real Customer',
      customer_phone: '+1987654321',
      cart: demoCart,
      total: demoCart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      notes: 'Real test order',
    };
    
    // Store in localStorage
    localStorage.setItem('pending-order-data', JSON.stringify(orderData));
    addResult("Order data stored in localStorage");
    
    // Navigate to checkout
    router.push('/checkout');
    addResult("Navigating to checkout page");
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Checkout Flow Test
          </h1>
          <p className="text-gray-600">
            Test the unified checkout flow with demo and real payment modes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Demo Mode Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Test the checkout flow with simulated payment (no Stripe required)
              </p>
              <Button 
                onClick={testDemoCheckout}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Check className="w-4 h-4 mr-2" />
                Test Demo Checkout
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Real Payment Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Test the checkout flow with real Stripe payment (requires Stripe keys)
              </p>
              <Button 
                onClick={testRealCheckout}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Test Real Checkout
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Test Results</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearResults}
              >
                Clear
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testResults.length === 0 ? (
              <p className="text-gray-500 text-sm">No test results yet. Run a test above.</p>
            ) : (
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Badge variant="secondary" className="text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-sm font-mono">{result}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Test Instructions</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Demo mode bypasses Stripe and simulates payment success</li>
            <li>• Real mode requires valid Stripe keys in environment variables</li>
            <li>• Both modes create orders with payment_status: 'PAID'</li>
            <li>• Orders should appear in live orders dashboard after creation</li>
            <li>• Check browser console for detailed logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
