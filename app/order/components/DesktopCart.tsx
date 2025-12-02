import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, CreditCard, Plus, Minus, X } from "lucide-react";
import { CartItem } from "../types";

interface DesktopCartProps {
  cart: CartItem[];
  totalPrice: number;
  totalItems: number;
  onRemoveFromCart: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onUpdateSpecialInstructions: (itemId: string, instructions: string) => void;
  onShowCheckout: () => void;
  isDemo?: boolean;
  onDirectSubmit?: () => void;
}

export function DesktopCart({
  cart,
  totalPrice,
  totalItems,
  onRemoveFromCart,
  onUpdateQuantity,
  onUpdateSpecialInstructions,
  onShowCheckout,
  isDemo = false,
  onDirectSubmit,
}: DesktopCartProps) {
  return (
    <div className="hidden lg:block">
      <Card className="sticky top-4 shadow-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-b border-gray-100 dark:border-gray-700">
          <CardTitle className="flex items-center text-lg text-gray-900 dark:text-white">
            <ShoppingCart className="mr-2 h-5 w-5 text-purple-600 dark:text-purple-400" />
            Your Order
          </CardTitle>
          <CardDescription className="text-gray-900 dark:text-gray-600">
            {totalItems} items • £{totalPrice.toFixed(2)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cart.length === 0 ? (
            <p className="text-gray-900 dark:text-gray-700 text-center py-8">
              Your cart is empty. Add some items to get started!
            </p>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                        {item.name}
                      </h4>
                      <p className="text-xs text-gray-900 dark:text-gray-600">
                        £{(item.price + (item.modifierPrice || 0)).toFixed(2)} each
                        {item.modifierPrice && item.modifierPrice > 0 && (
                          <span className="text-purple-600 dark:text-purple-400 ml-1">
                            (+£{item.modifierPrice.toFixed(2)} modifiers)
                          </span>
                        )}
                      </p>
                      {item.selectedModifiers && Object.keys(item.selectedModifiers).length > 0 && (
                        <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          {Object.entries(item.selectedModifiers).map(([modName, options]) => (
                            <span key={modName} className="mr-2">
                              {modName}: {options.join(", ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => onRemoveFromCart(item.id)}
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 h-6 w-6"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium text-gray-900 dark:text-white">
                        {item.quantity}
                      </span>
                      <Button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-gray-500"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                      £{((item.price + (item.modifierPrice || 0)) * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  {item.specialInstructions && (
                    <p className="text-xs text-gray-900 dark:text-gray-700 mb-2">
                      Note: {item.specialInstructions}
                    </p>
                  )}

                  <Textarea
                    placeholder="Special instructions (optional)"
                    value={item.specialInstructions || ""}
                    onChange={(e) => onUpdateSpecialInstructions(item.id, e.target.value)}
                    className="text-xs resize-none"
                    rows={2}
                  />
                </div>
              ))}

              <div className="border-t border-gray-200 dark:border-gray-600 pt-4 bg-white dark:bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    £{totalPrice.toFixed(2)}
                  </span>
                </div>

                <Button
                  onClick={() => {
                    if (isDemo && onDirectSubmit) {
                      onDirectSubmit();
                    } else {
                      onShowCheckout();
                    }
                  }}
                  variant="servio"
                  className="w-full py-3 text-lg font-medium"
                  disabled={cart.length === 0}
                >
                  <CreditCard className="h-5 w-5 mr-2" />
                  {isDemo ? "Place Order" : "Proceed to Checkout"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
