"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ShoppingCart } from "lucide-react";
import { formatPriceWithCurrency } from "@/lib/pricing-utils";

interface MenuItem {
  id: string;
  venue_id?: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  image_url?: string | null;
  is_available: boolean;
  created_at?: string;
  venue_name?: string;
  options?: Array<{ label: string; values: string[] }>;
}

interface ItemDetailsModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  quantity: number;
  isPreview?: boolean; // If true, hide cart functionality
}

export function ItemDetailsModal({
  item,
  isOpen,
  onClose,
  onAddToCart: _onAddToCart,
  onUpdateQuantity,
  quantity,
  isPreview = false,
}: ItemDetailsModalProps) {
  if (!item) return null;

  const handleAddToCart = () => {
    // Quantity is already tracked via onUpdateQuantity
    // Just close the modal
    onClose();
  };

  const handleIncrement = () => {
    onUpdateQuantity(item.id, quantity + 1);
  };

  const handleDecrement = () => {
    if (quantity > 0) {
      onUpdateQuantity(item.id, quantity - 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl md:text-3xl leading-tight">
            {item.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-5 md:space-y-6">
          {/* Item Image (if available) - Optimized for mobile/tablet */}
          {item.image_url && (
            <div className="relative w-full h-56 sm:h-64 md:h-72 lg:h-80 bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-cover"
                loading="lazy"
                style={{ objectPosition: "center" }}
              />
            </div>
          )}

          {/* Category */}
          <div className="flex items-center">
            <span className="text-xs md:text-sm font-medium text-muted-foreground bg-primary/10 px-2 py-1 rounded">
              {item.category}
            </span>
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Price */}
          <div className="flex items-center justify-between pt-2 sm:pt-3">
            <span className="text-xl sm:text-2xl md:text-3xl font-bold text-primary">
              {formatPriceWithCurrency(item.price, "£")}
            </span>
          </div>

          {/* Availability Status */}
          {!item.is_available && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 font-medium">Currently unavailable</p>
            </div>
          )}

          {/* Cart functionality only shown when NOT in preview mode */}
          {!isPreview && (
            <>
              {/* Quantity Controls - Always Visible - Optimized for mobile/tablet */}
              <div className="flex items-center justify-between pt-4 sm:pt-5 border-t">
                <div className="flex items-center space-x-3 sm:space-x-4 md:space-x-4 w-full">
                  <div className="flex flex-col space-y-1 sm:space-y-2">
                    <label className="text-sm sm:text-base md:text-lg font-semibold text-muted-foreground">
                      Quantity
                    </label>
                    <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-3 bg-muted rounded-lg p-2 sm:p-2.5 md:p-3">
                      <Button
                        onClick={handleDecrement}
                        variant="ghost"
                        size="sm"
                        className="h-12 w-12 sm:h-11 sm:w-11 md:h-10 md:w-10 p-0 min-h-[48px] sm:min-h-[44px]"
                        disabled={quantity === 0}
                      >
                        <Minus className="h-5 w-5 sm:h-5 sm:w-5 md:h-4 md:w-4" />
                      </Button>
                      <span className="text-2xl sm:text-xl md:text-lg font-bold min-w-[3rem] sm:min-w-[2.5rem] md:min-w-[2rem] text-center">
                        {quantity}
                      </span>
                      <Button
                        onClick={handleIncrement}
                        variant="ghost"
                        size="sm"
                        className="h-12 w-12 sm:h-11 sm:w-11 md:h-10 md:w-10 p-0 min-h-[48px] sm:min-h-[44px]"
                        disabled={!item.is_available}
                      >
                        <Plus className="h-5 w-5 sm:h-5 sm:w-5 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium">
                      Total
                    </p>
                    <p className="text-2xl sm:text-2xl md:text-2xl font-bold text-primary">
                      {formatPriceWithCurrency(item.price * quantity, "£")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Add to Cart Button - Only show when quantity > 0 - Optimized for mobile/tablet */}
              {quantity > 0 && (
                <Button
                  onClick={handleAddToCart}
                  disabled={!item.is_available}
                  className="w-full flex items-center justify-center space-x-2 h-14 sm:h-12 md:h-11 text-base sm:text-base md:text-sm font-semibold"
                  size="mobile"
                  variant="servio"
                >
                  <ShoppingCart className="h-6 w-6 sm:h-6 sm:w-6 md:h-5 md:w-5" />
                  <span>Add to Cart</span>
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
