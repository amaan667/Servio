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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{item.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item Image (if available) */}
          {item.image_url && (
            <div className="relative w-full aspect-[16/10] bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
          )}

          {/* Category */}
          <div className="flex items-center">
            <span className="text-sm font-medium text-muted-foreground bg-primary/10 px-2 py-1 rounded">
              {item.category}
            </span>
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          )}

          {/* Price */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-lg font-bold text-primary">
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
              {/* Quantity Controls - Always Visible */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-4 w-full">
                  <div className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">Quantity</label>
                    <div className="flex items-center space-x-2 bg-muted rounded-lg p-2">
                      <Button
                        onClick={handleDecrement}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={quantity === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="text-lg font-bold min-w-[2rem] text-center">{quantity}</span>
                      <Button
                        onClick={handleIncrement}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={!item.is_available}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-lg font-bold text-primary">
                      {formatPriceWithCurrency(item.price * quantity, "£")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Add to Cart Button - Only show when quantity > 0 */}
              {quantity > 0 && (
                <Button
                  onClick={handleAddToCart}
                  disabled={!item.is_available}
                  className="w-full flex items-center justify-center space-x-2"
                  size="lg"
                >
                  <ShoppingCart className="h-5 w-5" />
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
