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
import type { StockLevel } from "@/types/inventory";

interface StocktakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredient: StockLevel;
  onSuccess: () => void;
}

export function StocktakeDialog({
  open,
  onOpenChange,
  ingredient,
  onSuccess,
}: StocktakeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [actualCount, setActualCount] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const count = parseFloat(actualCount);
      if (isNaN(count)) return;

      const response = await fetch("/api/inventory/stock/stocktake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient_id: ingredient.ingredient_id,
          actual_count: count,
          note,
        }),
      });

      if (response.ok) {
        onSuccess();
        onOpenChange(false);
        setActualCount("");
        setNote("");
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  const delta = parseFloat(actualCount) - ingredient.on_hand;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stocktake - {ingredient.name}</DialogTitle>
          <DialogDescription>Record the actual physical count of this ingredient</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm">
                <span className="font-medium">System stock:</span> {ingredient.on_hand}{" "}
                {ingredient.unit}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="actual_count">Actual Count *</Label>
              <Input
                id="actual_count"
                type="number"
                step="0.01"
                placeholder="Enter physical count"
                value={actualCount}
                onChange={(e) => setActualCount(e.target.value)}
                required
              />
              {actualCount && !isNaN(parseFloat(actualCount)) && (
                <p className={`text-sm ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  Difference: {delta >= 0 ? "+" : ""}
                  {delta.toFixed(2)} {ingredient.unit}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Optional note about the stocktake"
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
              {loading ? "Recording..." : "Record Stocktake"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
