"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Minus, Users, CreditCard } from "lucide-react";
import { CartItem } from "../types";

interface BillSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  totalPrice: number;
  onSplitComplete: (splits: BillSplit[]) => void;
}

export interface BillSplit {
  id: string;
  name: string;
  items: CartItem[];
  total: number;
}

export function BillSplitModal({
  isOpen,
  onClose,
  cart,
  totalPrice,
  onSplitComplete,
}: BillSplitModalProps) {
  const [splitCount, setSplitCount] = useState(2);
  const [splits, setSplits] = useState<BillSplit[]>([]);
  const [splitNames, setSplitNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      initializeSplits();
    }
  }, [isOpen, splitCount]);

  const initializeSplits = () => {
    const newSplits: BillSplit[] = [];
    for (let i = 0; i < splitCount; i++) {
      const splitId = `split-${i + 1}`;
      newSplits.push({
        id: splitId,
        name: `Person ${i + 1}`,
        items: [],
        total: 0,
      });
      setSplitNames((prev) => ({
        ...prev,
        [splitId]: `Person ${i + 1}`,
      }));
    }
    setSplits(newSplits);
  };

  const toggleItemInSplit = (itemId: string, splitId: string) => {
    setSplits((prev) =>
      prev.map((split) => {
        if (split.id === splitId) {
          const itemIndex = split.items.findIndex((item) => item.id === itemId);
          if (itemIndex >= 0) {
            // Remove item from this split
            const newItems = split.items.filter((item) => item.id !== itemId);
            const newTotal = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
            return { ...split, items: newItems, total: newTotal };
          } else {
            // Add item to this split (check if it's already in another split)
            const item = cart.find((i) => i.id === itemId);
            if (!item) return split;

            // Check if item is already in another split
            const inOtherSplit = prev.some(
              (s) => s.id !== splitId && s.items.some((i) => i.id === itemId)
            );
            if (inOtherSplit) {
              // Remove from other split first
              const otherSplits = prev.map((s) => {
                if (s.id !== splitId && s.items.some((i) => i.id === itemId)) {
                  return {
                    ...s,
                    items: s.items.filter((i) => i.id !== itemId),
                    total: s.total - (item.price + (item.modifierPrice || 0)) * item.quantity,
                  };
                }
                return s;
              });
              // Then add to current split
              const newItems = [...split.items, item];
              const newTotal = split.total + item.price * item.quantity;
              return { ...split, items: newItems, total: newTotal };
            }

            // Add item to this split
            const newItems = [...split.items, item];
            const newTotal = split.total + (item.price + (item.modifierPrice || 0)) * item.quantity;
            return { ...split, items: newItems, total: newTotal };
          }
        }
        return split;
      })
    );
  };

  const isItemInSplit = (itemId: string, splitId: string) => {
    return splits.some(
      (split) => split.id === splitId && split.items.some((item) => item.id === itemId)
    );
  };

  const getItemSplitCount = (itemId: string) => {
    return splits.filter((split) => split.items.some((item) => item.id === itemId)).length;
  };

  const updateSplitName = (splitId: string, name: string) => {
    setSplitNames((prev) => ({ ...prev, [splitId]: name }));
    setSplits((prev) => prev.map((split) => (split.id === splitId ? { ...split, name } : split)));
  };

  const getTotalSplitAmount = () => {
    return splits.reduce((sum, split) => sum + split.total, 0);
  };

  const getRemainingAmount = () => {
    return totalPrice - getTotalSplitAmount();
  };

  const handleComplete = () => {
    const validSplits = splits.filter((split) => split.items.length > 0);
    if (validSplits.length === 0) {
      alert("Please assign items to at least one person.");
      return;
    }

    if (Math.abs(getRemainingAmount()) > 0.01) {
      alert(
        "Please assign all items to splits. Remaining amount: £" + getRemainingAmount().toFixed(2)
      );
      return;
    }

    onSplitComplete(validSplits);
    onClose();
  };

  const availableItems = cart.filter((item) => getItemSplitCount(item.id) === 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Split Bill
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Split Count Control */}
          <div className="flex items-center justify-between">
            <Label>Number of People:</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSplitCount(Math.max(2, splitCount - 1))}
                disabled={splitCount <= 2}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center font-medium">{splitCount}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSplitCount(Math.min(10, splitCount + 1))}
                disabled={splitCount >= 10}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Splits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {splits.map((split) => (
              <Card key={split.id} className="border-2">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Input
                        value={splitNames[split.id] || split.name}
                        onChange={(e) => updateSplitName(split.id, e.target.value)}
                        placeholder="Person name"
                        className="font-medium"
                      />
                      <Badge variant="secondary" className="ml-2">
                        £{split.total.toFixed(2)}
                      </Badge>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {split.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No items assigned
                        </p>
                      ) : (
                        split.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-sm bg-muted p-2 rounded"
                          >
                            <span>
                              {item.quantity}x {item.name}
                            </span>
                            <span className="font-medium">
                              £
                              {((item.price + (item.modifierPrice || 0)) * item.quantity).toFixed(
                                2
                              )}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Available Items */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Assign Items:</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4">
              {cart.map((item) => {
                const inSplits = splits.filter((split) =>
                  split.items.some((i) => i.id === item.id)
                );
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 hover:bg-muted rounded"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {item.quantity}x {item.name}
                        </span>
                        {item.selectedModifiers &&
                          Object.keys(item.selectedModifiers).length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              +modifiers
                            </Badge>
                          )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        £{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {inSplits.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {inSplits.length} split{inSplits.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      <div className="flex gap-1">
                        {splits.map((split) => (
                          <Checkbox
                            key={split.id}
                            checked={isItemInSplit(item.id, split.id)}
                            onCheckedChange={() => toggleItemInSplit(item.id, split.id)}
                            className="h-4 w-4"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">Total Bill:</span>
              <span className="font-bold">£{totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">Split Total:</span>
              <span className="font-bold">£{getTotalSplitAmount().toFixed(2)}</span>
            </div>
            {Math.abs(getRemainingAmount()) > 0.01 && (
              <div className="flex justify-between items-center text-red-600">
                <span className="font-medium">Remaining:</span>
                <span className="font-bold">£{getRemainingAmount().toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={Math.abs(getRemainingAmount()) > 0.01}>
            <CreditCard className="h-4 w-4 mr-2" />
            Continue to Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
