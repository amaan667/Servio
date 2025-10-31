"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";

// Import the POST-payment OrderSummary component
import OrderSummary from "@/components/order-summary";

// Hooks
import { useOrderSummary } from "./hooks/useOrderSummary";

// Components
import { OrderDetailsCard } from "./components/OrderDetailsCard";
import { CartItemsCard } from "./components/CartItemsCard";

/**
 * Order Summary Page
 *
 * DUAL PURPOSE:
 * 1. PRE-payment: Shows cart and order details before payment (no orderId query param)
 * 2. POST-payment: Shows order confirmation with status timeline (has orderId query param)
 *
 * Refactored: Extracted hooks and components for better organization
 */

export default function OrderSummaryPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get("orderId");
  const sessionId = searchParams?.get("sessionId");

  // PRE-PAYMENT: Show the cart summary before payment
  const { orderData, loading, isCreatingOrder, orderPlaced, handlePayNow } = useOrderSummary();

  // POST-PAYMENT: If orderId or sessionId exists, show the confirmation page
  if (orderId || sessionId) {
    return <OrderSummary orderId={orderId || undefined} sessionId={sessionId || undefined} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 mb-2">No Order Data Found</p>
          <p className="text-gray-600">This order could not be loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Order Summary</h1>
          <p className="text-gray-600 mt-2">{orderData.venueName}</p>
        </div>

        {/* Order Placed Success Message */}
        {orderPlaced && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Order Placed Successfully!</p>
              <p className="text-sm text-green-700">Redirecting to payment...</p>
            </div>
          </div>
        )}

        {/* Order Details and Cart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <OrderDetailsCard orderData={orderData} />
          <CartItemsCard orderData={orderData} />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            disabled={isCreatingOrder || orderPlaced}
            className="flex-1"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Order
          </Button>
          <Button
            onClick={handlePayNow}
            disabled={isCreatingOrder || orderPlaced}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {isCreatingOrder ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay Now
              </>
            )}
          </Button>
        </div>

        {/* Info Message */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 Your order will be prepared as soon as payment is confirmed. You&apos;ll receive
            updates on your order status.
          </p>
        </div>
      </div>
    </div>
  );
}
