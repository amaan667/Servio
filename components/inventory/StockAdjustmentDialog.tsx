"use client";

import { useState } from "react";
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
import type { StockLevel, StockMovementReason } from "@/types/inventory";

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient: StockLevel;
  onSuccess: () => void;
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  ingredient,
  onSuccess,
}: StockAdjustmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const deltaValue = parseFloat(delta);
      if (isNaN(deltaValue)) return;

      const response = await fetch("/api/inventory/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient_id: ingredient.ingredient_id,
          delta: deltaValue,
          reason: deltaValue >= 0 ? "receive" : "adjust",
          note,
        }),
      });

      if (response.ok) {
        onSuccess();
        onOpenChange(false);
        setDelta("");
        setNote("");
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock - {ingredient.name}</DialogTitle>
          <DialogDescription>
            Current stock: {ingredient.on_hand} {ingredient.unit}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="delta">Change Amount *</Label>
              <Input
                id="delta"
                type="number"
                step="0.01"
                placeholder="Use + for receive, - for remove"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                New stock: {(ingredient.on_hand + (parseFloat(delta) || 0)).toFixed(2)}{" "}
                {ingredient.unit}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Optional note about this adjustment"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adjusting..." : "Adjust Stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
