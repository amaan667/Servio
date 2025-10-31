"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  ArrowLeft,
  CreditCard,
  Clock,
  Shield,
  Receipt,
  Star,
  Loader2,
  User,
  Phone,
} from "lucide-react";
import { CustomerFeedbackForm } from "@/components/customer-feedback-form";
import { OrderTimeline } from "@/components/order-timeline";

// Hooks
import { usePaymentState } from "./hooks/usePaymentState";
import { usePaymentProcessing } from "./hooks/usePaymentProcessing";

/**
 * Payment Page
 * Handles order payment and confirmation
 *
 * Refactored: Extracted hooks for better organization
 * Original: 528 lines → Now: ~200 lines
 */

export default function PaymentPage() {
  const paymentState = usePaymentState();
  const { processPayment } = usePaymentProcessing();

  const handlePayment = async (action: "demo" | "stripe" | "till" | "later") => {
    if (!paymentState.checkoutData) return;

    paymentState.setPaymentAction(action);
    await processPayment(
      action,
      paymentState.checkoutData,
      paymentState.setOrderNumber,
      paymentState.setPaymentComplete,
      paymentState.setIsProcessing,
      paymentState.setError
    );
  };

  if (!paymentState.checkoutData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading payment details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Order</h1>
          <p className="text-gray-600 mt-2">{paymentState.checkoutData.venueName}</p>
        </div>

        {/* Payment Complete */}
        {paymentState.paymentComplete && (
          <Card className="mb-6 shadow-lg bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Check className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-900">Payment Successful!</h3>
                  <p className="text-green-700">Order #{paymentState.orderNumber}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {paymentState.error && (
          <Card className="mb-6 shadow-lg bg-red-50 border-red-200">
            <CardContent className="p-6">
              <p className="text-red-800">{paymentState.error}</p>
            </CardContent>
          </Card>
        )}

        {/* Customer Information */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-purple-600" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{paymentState.checkoutData.customerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{paymentState.checkoutData.customerPhone}</span>
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-purple-600" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentState.checkoutData.cart.map((item, index) => (
              <div key={index}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    {item.specialInstructions && (
                      <p className="text-sm text-gray-600 mt-1">Note: {item.specialInstructions}</p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-medium">£{(item.price * item.quantity).toFixed(2)}</p>
                    <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                  </div>
                </div>
                {index < paymentState.checkoutData!.cart.length - 1 && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}

            <Separator className="my-4" />

            <div className="flex justify-between items-center">
              <p className="text-lg font-semibold">Total</p>
              <p className="text-xl font-bold text-purple-600">
                £{paymentState.checkoutData.total.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payment Options */}
        {!paymentState.paymentComplete && (
          <Card className="mb-6 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-600" />
                Payment Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Demo Payment (if applicable) */}
              {paymentState.isDemo && (
                <Button
                  onClick={() => handlePayment("demo")}
                  disabled={paymentState.isProcessing}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {paymentState.isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Complete Demo Order
                    </>
                  )}
                </Button>
              )}

              {/* Payment Method Buttons - All Same Style */}
              <div className="space-y-3">
                {/* Stripe Payment */}
                {!paymentState.isDemo && (
                  <Button
                    onClick={() => {
                      handlePayment("stripe");
                    }}
                    disabled={paymentState.isProcessing}
                    variant="default"
                    className="w-full h-12 text-base"
                  >
                    {paymentState.isProcessing && paymentState.paymentAction === "stripe" ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5 mr-2" />
                        Pay Now
                      </>
                    )}
                  </Button>
                )}

                {/* Pay at Till */}
                <Button
                  variant="default"
                  onClick={() => {
                    handlePayment("till");
                  }}
                  disabled={paymentState.isProcessing}
                  className="w-full h-12 text-base"
                >
                  {paymentState.isProcessing && paymentState.paymentAction === "till" ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Receipt className="h-5 w-5 mr-2" />
                      Pay at Till
                    </>
                  )}
                </Button>

                {/* Pay Later */}
                <Button
                  variant="default"
                  onClick={() => {
                    handlePayment("later");
                  }}
                  disabled={paymentState.isProcessing}
                  className="w-full h-12 text-base"
                >
                  {paymentState.isProcessing && paymentState.paymentAction === "later" ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5 mr-2" />
                      Pay Later
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security Notice */}
        <Card className="mb-6 shadow-lg bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Your payment information is secure and encrypted. We never store your card details.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Feedback Form */}
        {paymentState.paymentComplete && !paymentState.showFeedback && (
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="text-center">
                <Star className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How was your experience?
                </h3>
                <p className="text-gray-600 mb-4">We'd love to hear your feedback!</p>
                <Button onClick={() => paymentState.setShowFeedback(true)}>Leave Feedback</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {paymentState.showFeedback && !paymentState.feedbackSubmitted && (
          <CustomerFeedbackForm
            venueId={paymentState.checkoutData.venueId}
            orderId={paymentState.orderNumber}
            customerName={paymentState.checkoutData.customerName || "Customer"}
            onFeedbackSubmitted={() => {
              paymentState.setFeedbackSubmitted(true);
              paymentState.setShowFeedback(false);
            }}
          />
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => {
              // Go back to order page with venueId and preserve cart
              const venueSlug = paymentState.checkoutData?.venueId || "";
              const tableNumber = paymentState.checkoutData?.tableNumber || "";
              // Add skipGroupSize flag to prevent group size modal from showing
              window.location.href = `/order?venue=${venueSlug}&table=${tableNumber}&skipGroupSize=true`;
            }}
            disabled={paymentState.isProcessing}
            className="flex-1"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {paymentState.paymentComplete && (
            <Button
              onClick={() => (window.location.href = `/order-summary/${paymentState.orderNumber}`)}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
            >
              View Order
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
