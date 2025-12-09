"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard, Plus, Minus, X } from "lucide-react";
import { CartItem } from "../types";

interface MobileCartProps {
  cart: CartItem[];
  totalPrice: number;
  totalItems: number;
  showMobileCart: boolean;
  onClose: () => void;
  onRemoveFromCart: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onUpdateSpecialInstructions: (itemId: string, instructions: string) => void;
  onShowCheckout: () => void;
  isDemo?: boolean;
  onDirectSubmit?: () => void;
}

export function MobileCart({
  cart,
  totalPrice,
  totalItems,
  showMobileCart,
  onClose,
  onRemoveFromCart,
  onUpdateQuantity,
  onUpdateSpecialInstructions,
  onShowCheckout,
  isDemo = false,
  onDirectSubmit,
}: MobileCartProps) {
  if (!showMobileCart) return null;

  return (
    <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50">
      <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <div className="flex justify-between items-center">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold truncate text-gray-900 dark:text-white">
                Your Order
              </h3>
              <p className="text-sm text-gray-900 dark:text-gray-600">
                {totalItems} items • £{totalPrice.toFixed(2)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="ml-2 min-h-[44px] min-w-[44px] flex-shrink-0 text-gray-900 hover:text-gray-900"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <p className="text-gray-900 text-center py-8">
              Your cart is empty. Add some items to get started!
            </p>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-base">{item.name}</h4>
                        {item.selectedModifiers && Object.keys(item.selectedModifiers).length > 0 && (
                          <div className="text-xs text-purple-600 mt-1">
                            {Object.entries(item.selectedModifiers).map(([modName, options]) => (
                              <span key={modName} className="mr-2">
                                {modName}: {options.join(", ")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-900">£{item.price.toFixed(2)} each</p>
                    </div>
                    <Button
                      onClick={() => onRemoveFromCart(item.id)}
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 p-1 h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        size="sm"
                        variant="outline"
                        className="min-h-[40px] min-w-[40px]"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-lg font-medium min-w-[2rem] text-center">
                        {item.quantity}
                      </span>
                      <Button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        size="sm"
                        variant="outline"
                        className="min-h-[40px] min-w-[40px]"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                      £{((item.price + (item.modifierPrice || 0)) * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  {item.specialInstructions && (
                    <p className="text-xs text-gray-900 mb-2">Note: {item.specialInstructions}</p>
                  )}

                  <Textarea
                    placeholder="Special instructions (optional)"
                    value={item.specialInstructions || ""}
                    onChange={(e) => onUpdateSpecialInstructions(item.id, e.target.value)}
                    className="text-sm resize-none"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t p-4 flex-shrink-0 bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                £{totalPrice.toFixed(2)}
              </span>
            </div>

            <Button
              onClick={() => {
                onClose();
                if (isDemo && onDirectSubmit) {
                  onDirectSubmit();
                } else {
                  onShowCheckout();
                }
              }}
              variant="servio"
              className="w-full min-h-[48px] text-base font-medium"
              disabled={cart.length === 0}
            >
              <CreditCard className="h-5 w-5 mr-2" />
              {isDemo ? "Place Order" : "Proceed to Checkout"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
