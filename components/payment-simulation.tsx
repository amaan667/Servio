"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Lock, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface PaymentSimulationProps {

}

export default function PaymentSimulation({ amount, onPaymentComplete }: PaymentSimulationProps) {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "digital-wallet" | null>(null);
  const [cardDetails, setCardDetails] = useState({

  const [paymentStatus, setPaymentStatus] = useState<
    "pending" | "processing" | "success" | "failed"
  >("pending");
  const [showCardForm, setShowCardForm] = useState(false);

  const handlePaymentMethodSelect = (method: "card" | "digital-wallet") => {
    setPaymentMethod(method);
    if (method === "card") {
      setShowCardForm(true);
    } else {
      setShowCardForm(false);
    }
  };

  const simulatePayment = async () => {
    setPaymentStatus("processing");

    // Simulate 95% success rate
    const isSuccess = Math.random() > 0.05;

    if (isSuccess) {
      setPaymentStatus("success");
      // Complete immediately - no artificial delay
      onPaymentComplete();
    } else {
      setPaymentStatus("failed");
    }
  };

  const getStatusDisplay = () => {
    switch (paymentStatus) {
      case "processing":
        return {

        };
      case "success":
        return {

        };
      case "failed":
        return {

        };

        };
    }
  };

  const StatusIcon = getStatusDisplay().icon;

  if (paymentStatus === "success") {
    return (
      <Card className="w-full border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-800 mb-2">Payment Successful!</h3>
            <p className="text-green-700">Your order has been confirmed and payment processed.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment
          <Badge variant="secondary" className="ml-auto">
            £{amount.toFixed(2)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment Status */}
        <div className={`p-3 rounded-lg ${getStatusDisplay().bgColor}`}>
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${getStatusDisplay().color}`} />
            <span className={`text-sm ${getStatusDisplay().color}`}>{getStatusDisplay().text}</span>
          </div>
        </div>

        {/* Payment Methods */}
        {paymentStatus === "pending" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={paymentMethod === "card" ? "default" : "outline"}
                onClick={() => handlePaymentMethodSelect("card")}
                className="h-20 flex-col gap-2"
              >
                <CreditCard className="h-6 w-6" />
                <span className="text-sm">Credit Card</span>
              </Button>

              <Button
                variant={paymentMethod === "digital-wallet" ? "default" : "outline"}
                onClick={() => handlePaymentMethodSelect("digital-wallet")}
                className="h-20 flex-col gap-2"
              >
                <div className="flex gap-1">
                  <div className="w-6 h-6 bg-servio-purple rounded"></div>
                  <div className="w-6 h-6 bg-blue-600 rounded"></div>
                </div>
                <span className="text-sm">Digital Wallet</span>
              </Button>
            </div>

            {/* Card Form */}
            {showCardForm && (
              <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="card-number">Card Number</Label>
                    <Input
                      id="card-number"
                      placeholder="1234 5678 9012 3456"
                      value={cardDetails.number}
                      onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                      maxLength={19}
                    />
                  </div>
                  <div>
                    <Label htmlFor="expiry">Expiry</Label>
                    <Input
                      id="expiry"
                      placeholder="MM/YY"
                      value={cardDetails.expiry}
                      onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                      maxLength={5}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cvv">CVV</Label>
                    <Input
                      id="cvv"
                      placeholder="123"
                      value={cardDetails.cvv}
                      onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                      maxLength={4}
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Name on Card</Label>
                    <Input
                      id="name"
                      placeholder="John Doe"
                      value={cardDetails.name}
                      onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Digital Wallet Simulation */}
            {paymentMethod === "digital-wallet" && !showCardForm && (
              <div className="p-4 border rounded-lg bg-gray-50 text-center">
                <div className="flex justify-center gap-4 mb-4">
                  <div className="w-12 h-8 bg-servio-purple rounded flex items-center justify-center text-white text-xs font-bold">
                    Apple
                  </div>
                  <div className="w-12 h-8 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                    Google
                  </div>
                </div>
                <p className="text-sm text-gray-900">Tap your phone or watch to complete payment</p>
              </div>
            )}

            {/* Pay Button */}
            {paymentMethod && (
              <Button
                onClick={simulatePayment}
                variant="servio"
                className="w-full"
                disabled={false}
              >
                <Lock className="h-4 w-4 mr-2" />
                Pay £{amount.toFixed(2)}
              </Button>
            )}
          </div>
        )}

        {/* Processing State */}
        {paymentStatus === "processing" && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-900">Processing your payment...</p>
          </div>
        )}

        {/* Failed State */}
        {paymentStatus === "failed" && (
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                Payment failed. This is a demo - in a real scenario, you would see specific error
                details.
              </p>
            </div>
            <Button
              onClick={() => setPaymentStatus("pending")}
              variant="outline"
              className="w-full"
            >
              Try Again
            </Button>
          </div>
        )}

        <div className="text-xs text-gray-900 text-center pt-2 border-t">
          <p>This is a payment simulation for demo purposes</p>
          <p>No real charges will be made</p>
        </div>
      </CardContent>
    </Card>
  );
}
