'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import { formatPriceWithCurrency } from '@/lib/pricing-utils';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
}

interface ItemDetailsModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  quantity: number;
}

export function ItemDetailsModal({
  item,
  isOpen,
  onClose,
  onAddToCart,
  onUpdateQuantity,
  quantity
}: ItemDetailsModalProps) {
  if (!item) return null;

  const handleAddToCart = () => {
    onAddToCart(item);
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
          {/* Category */}
          <div className="flex items-center">
            <span className="text-sm font-medium text-muted-foreground bg-primary/10 px-2 py-1 rounded">
              {item.category}
            </span>
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Price */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-lg font-bold text-primary">
              {formatPriceWithCurrency(item.price, '£')}
            </span>
          </div>

          {/* Availability Status */}
          {!item.is_available && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700 font-medium">
                Currently unavailable
              </p>
            </div>
          )}

          {/* Quantity Controls */}
          <div className="flex items-center justify-between pt-4 border-t">
            {quantity === 0 ? (
              <Button
                onClick={handleAddToCart}
                disabled={!item.is_available}
                className="w-full flex items-center justify-center space-x-2"
                size="lg"
              >
                <ShoppingCart className="h-5 w-5" />
                <span>Add to Cart</span>
              </Button>
            ) : (
              <div className="flex items-center space-x-4 w-full">
                <div className="flex items-center space-x-2 bg-muted rounded-lg p-2">
                  <Button
                    onClick={handleDecrement}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-lg font-bold min-w-[2rem] text-center">
                    {quantity}
                  </span>
                  <Button
                    onClick={handleIncrement}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-bold text-primary">
                    {formatPriceWithCurrency(item.price * quantity, '£')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

