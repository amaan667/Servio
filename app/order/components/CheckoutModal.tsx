"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, X, AlertCircle } from "lucide-react";
import { CustomerInfo } from "../types";
import { useState } from "react";

interface CheckoutModalProps {

  onUpdateCustomerInfo: (field: "name" | "phone", value: string) => void;

}

export function CheckoutModal({
  show,
  customerInfo,
  totalPrice,
  isSubmitting,
  onClose,
  onUpdateCustomerInfo,
  onSubmit,
}: CheckoutModalProps) {
  const [nameError, setNameError] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string>("");

  const validateName = (value: string): boolean => {
    // Allow letters, spaces, hyphens, and apostrophes only
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!value.trim()) {
      setNameError("Name is required");
      return false;
    }
    if (!nameRegex.test(value)) {
      setNameError("Name should only contain letters");
      return false;
    }
    setNameError("");
    return true;
  };

  const validatePhone = (value: string): boolean => {
    // Remove spaces and check if it's a valid phone number
    const cleanPhone = value.replace(/\s/g, "");

    if (!value.trim()) {
      setPhoneError("Phone number is required");
      return false;
    }

    // Check if it starts with + (international format)
    if (cleanPhone.startsWith("+")) {
      // International format: +44 followed by digits
      const phoneRegex = /^\+\d{1,4}\d{7,15}$/;
      if (!phoneRegex.test(cleanPhone)) {
        setPhoneError("Please enter a valid phone number (e.g., +44 7123 456789)");
        return false;
      }
    } else {
      // Local format: just digits
      const phoneRegex = /^\d{7,15}$/;
      if (!phoneRegex.test(cleanPhone)) {
        setPhoneError("Phone number should only contain numbers (or use +44 format)");
        return false;
      }
    }

    setPhoneError("");
    return true;
  };

  const handleNameChange = (value: string) => {
    // Only allow letters, spaces, hyphens, and apostrophes
    const filteredValue = value.replace(/[^a-zA-Z\s'-]/g, "");
    onUpdateCustomerInfo("name", filteredValue);
    if (filteredValue !== value) {
      setNameError("Name should only contain letters");
    } else if (nameError) {
      validateName(filteredValue);
    }
  };

  const handlePhoneChange = (value: string) => {
    // Allow only numbers, spaces, and + at the start
    const filteredValue = value.replace(/[^\d\s+]/g, "");
    // Ensure + can only be at the start
    const cleanValue = filteredValue.startsWith("+")
      ? "+" + filteredValue.slice(1).replace(/\+/g, "")
      : filteredValue.replace(/\+/g, "");

    onUpdateCustomerInfo("phone", cleanValue);
    if (cleanValue !== value) {
      setPhoneError("Phone number should only contain numbers");
    } else if (phoneError) {
      validatePhone(cleanValue);
    }
  };

  const handleSubmit = () => {
    const isNameValid = validateName(customerInfo.name);
    const isPhoneValid = validatePhone(customerInfo.phone);

    if (isNameValid && isPhoneValid) {
      onSubmit();
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <Card className="w-full sm:max-w-md sm:w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-lg">
        <CardHeader className="flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg sm:text-xl">Complete Your Order</CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Enter your details to complete the order
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="ml-2 min-h-[44px] min-w-[44px] flex-shrink-0 sm:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-500 mb-2">
                Name *
              </label>
              <Input
                value={customerInfo.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter your name"
                required
                className={`min-h-[48px] text-base ${nameError ? "border-red-500 focus:border-red-500" : ""}`}
              />
              {nameError && (
                <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{nameError}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-500 mb-2">
                Phone Number *
              </label>
              <Input
                value={customerInfo.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+44 7123 456789"
                type="tel"
                className={`min-h-[48px] text-base ${phoneError ? "border-red-500 focus:border-red-500" : ""}`}
              />
              {phoneError && (
                <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{phoneError}</span>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Use international format (e.g., +44 for UK) or local number
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-6">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
              <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                £{totalPrice.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 min-h-[48px] text-base font-medium order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 min-h-[48px] text-base font-medium order-1 sm:order-2"
                disabled={isSubmitting || !customerInfo.name.trim() || !customerInfo.phone.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Order"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
