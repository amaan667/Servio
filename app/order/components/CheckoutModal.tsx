import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";
import { CustomerInfo } from '../types';

interface CheckoutModalProps {
  show: boolean;
  customerInfo: CustomerInfo;
  totalPrice: number;
  isSubmitting: boolean;
  onClose: () => void;
  onUpdateCustomerInfo: (field: 'name' | 'phone', value: string) => void;
  onSubmit: () => void;
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
                onChange={(e) => onUpdateCustomerInfo('name', e.target.value)}
                placeholder="Enter your name"
                required
                className="min-h-[48px] text-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-500 mb-2">
                Phone Number *
              </label>
              <Input
                value={customerInfo.phone}
                onChange={(e) => onUpdateCustomerInfo('phone', e.target.value)}
                placeholder="Enter your phone number"
                type="tel"
                className="min-h-[48px] text-base"
              />
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
                onClick={onSubmit}
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

