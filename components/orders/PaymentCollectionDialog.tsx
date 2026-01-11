"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Banknote, CreditCard, Receipt } from "lucide-react";

interface PaymentCollectionDialogProps {

  }>;

}

export function PaymentCollectionDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  customerName,
  totalAmount,
  venueId,
  items,
  onSuccess,
}: PaymentCollectionDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "card" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCollectPayment = async () => {
    if (!selectedMethod) {
      setError("Please select a payment method");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/collect-payment`, {

        headers: { "Content-Type": "application/json" },

        }),

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to collect payment");
      }

      // Close dialog and refresh parent
      onOpenChange(false);
      onSuccess();
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to collect payment");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collect Payment</DialogTitle>
          <DialogDescription>
            Process payment for this order at the till or card reader
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Order Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Order:</span>
              <span className="font-medium">#{orderNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Customer:</span>
              <span className="font-medium">{customerName}</span>
            </div>
          </div>

          {/* Items */}
          <div>
            <h4 className="text-sm font-medium mb-2">Items</h4>
            <div className="space-y-1">
              {items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.quantity}x {item.item_name}
                  </span>
                  <span className="font-medium">£{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="bg-purple-50 rounded-lg p-4 flex justify-between items-center">
            <span className="font-semibold">Total Amount</span>
            <span className="text-2xl font-bold text-purple-600">£{totalAmount.toFixed(2)}</span>
          </div>

          {/* Payment Method Selection */}
          <div>
            <h4 className="text-sm font-medium mb-3">Select Payment Method</h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedMethod("cash")}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                  selectedMethod === "cash"
                    ? "border-purple-600 bg-purple-50"

                }`}
              >
                <Banknote
                  className={`h-8 w-8 mb-2 ${
                    selectedMethod === "cash" ? "text-purple-600" : "text-gray-400"
                  }`}
                />
                <span
                  className={`font-medium ${
                    selectedMethod === "cash" ? "text-purple-600" : "text-gray-700"
                  }`}
                >
                  Cash
                </span>
              </button>

              <button
                onClick={() => setSelectedMethod("card")}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                  selectedMethod === "card"
                    ? "border-purple-600 bg-purple-50"

                }`}
              >
                <CreditCard
                  className={`h-8 w-8 mb-2 ${
                    selectedMethod === "card" ? "text-purple-600" : "text-gray-400"
                  }`}
                />
                <span
                  className={`font-medium ${
                    selectedMethod === "card" ? "text-purple-600" : "text-gray-700"
                  }`}
                >
                  Card
                </span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleCollectPayment}
            disabled={processing || !selectedMethod}
            variant="servio"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Receipt className="mr-2 h-4 w-4" />
                Confirm Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
