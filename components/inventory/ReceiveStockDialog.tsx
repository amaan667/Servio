"use client";

import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StockLevel } from "@/types/inventory";

interface ReceiveStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient: StockLevel;
  onSuccess: () => void;
}

export function ReceiveStockDialog({
  open,
  onOpenChange,
  ingredient,
  onSuccess,
}: ReceiveStockDialogProps) {
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [costPerUnit, setCostPerUnit] = useState(ingredient.cost_per_unit?.toString() || "");
  const [supplier, setSupplier] = useState(ingredient.supplier || "");
  const [note, setNote] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const quantityValue = parseFloat(quantity);
      const costValue = parseFloat(costPerUnit);

      if (isNaN(quantityValue) || quantityValue <= 0) {
        toast({ title: "Invalid Input", description: "Please enter a valid quantity", variant: "destructive" });
        return;
      }

      // Update ingredient cost and supplier if changed
      if (costValue !== ingredient.cost_per_unit || supplier !== ingredient.supplier) {
        await fetch(`/api/inventory/ingredients/${ingredient.ingredient_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cost_per_unit: costValue,
            supplier: supplier,
          }),
        });
      }

      // Record the stock receipt
      const response = await fetch("/api/inventory/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient_id: ingredient.ingredient_id,
          delta: quantityValue,
          reason: "receive",
          note:
            note ||
            `Received ${quantityValue} ${ingredient.unit} from ${supplier || "supplier"} @ $${costValue}/unit`,
        }),
      });

      if (response.ok) {
        onSuccess();
        onOpenChange(false);
        setQuantity("");
        setCostPerUnit("");
        setSupplier("");
        setNote("");
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  const totalCost = (parseFloat(quantity) || 0) * (parseFloat(costPerUnit) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive Stock - {ingredient.name}</DialogTitle>
          <DialogDescription>
            Record incoming inventory and update cost information
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity Received *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Current: {ingredient.on_hand} {ingredient.unit}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cost">Cost per {ingredient.unit} *</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Previous: ${ingredient.cost_per_unit || "0.00"}
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                placeholder="Supplier name"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Optional note about this receipt"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>

            {/* Summary */}
            <div className="bg-muted rounded-md p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>New Stock Level:</span>
                <span className="font-medium">
                  {(ingredient.on_hand + (parseFloat(quantity) || 0)).toFixed(2)} {ingredient.unit}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Purchase Cost:</span>
                <span className="font-bold text-green-600">£{totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Processing..." : "Receive Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
