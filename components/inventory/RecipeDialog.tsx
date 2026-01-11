"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import type { IngredientUnit, StockLevel } from "@/types/inventory";

interface RecipeDialogProps {

}

interface RecipeRow {

}

export function RecipeDialog({
  open,
  onOpenChange,
  menuItemId,
  menuItemName,
  venueId,
}: RecipeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [ingredients, setIngredients] = useState<StockLevel[]>([]);
  const [recipe, setRecipe] = useState<RecipeRow[]>([]);
  const [newIngredientId, setNewIngredientId] = useState("");
  const [newQuantity, setNewQuantity] = useState("");

  useEffect(() => {
    if (open) {
      fetchIngredients();
      fetchRecipe();
    }
  }, [open, menuItemId]);

  const fetchIngredients = async () => {
    try {
      const response = await fetch(`/api/inventory/ingredients?venue_id=${venueId}`);
      const result = await response.json();
      if (result.data) {
        setIngredients(result.data);
      }
    } catch (_error) {
      // Error silently handled
    }
  };

  const fetchRecipe = async () => {
    try {
      const response = await fetch(`/api/inventory/recipes/${menuItemId}`);
      const result = await response.json();
      if (result.data) {
        const mappedRecipe = result.data.map((item: Record<string, unknown>) => {
          const ingredient = item.ingredient as
            | { name?: string; cost_per_unit?: number }
            | undefined;
          return {

          };

        setRecipe(mappedRecipe);
      }
    } catch (_error) {
      // Error silently handled
    }
  };

  const addIngredient = () => {
    if (!newIngredientId || !newQuantity) return;

    const ingredient = ingredients.find((i) => i.ingredient_id === newIngredientId);
    if (!ingredient) return;

    setRecipe([
      ...recipe,
      {

      },
    ]);

    setNewIngredientId("");
    setNewQuantity("");
  };

  const removeIngredient = (ingredientId: string) => {
    setRecipe(recipe.filter((r) => r.ingredient_id !== ingredientId));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/inventory/recipes/${menuItemId}`, {

        headers: { "Content-Type": "application/json" },

          })),
        }),

      if (response.ok) {
        onOpenChange(false);
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  const totalCost = recipe.reduce(
    (sum, item) => sum + (item.cost_per_unit || 0) * item.qty_per_item,
    0
  );

  const availableIngredients = ingredients.filter(
    (i) => !recipe.some((r) => r.ingredient_id === i.ingredient_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recipe & Costing - {menuItemName}</DialogTitle>
          <DialogDescription>
            Define ingredients and quantities for this menu item
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Cost Summary */}
          <div className="bg-muted p-4 rounded-md">
            <div className="flex justify-between items-center">
              <span className="font-medium">Estimated Cost per Item:</span>
              <span className="text-2xl font-bold text-green-600">£{totalCost.toFixed(2)}</span>
            </div>
          </div>

          {/* Current Recipe */}
          {recipe.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Cost/Unit</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipe.map((item) => (
                    <TableRow key={item.ingredient_id}>
                      <TableCell className="font-medium">{item.ingredient_name}</TableCell>
                      <TableCell>{item.qty_per_item}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>£{item.cost_per_unit?.toFixed(2) || "0.00"}</TableCell>
                      <TableCell className="font-medium">
                        £{((item.cost_per_unit || 0) * item.qty_per_item).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIngredient(item.ingredient_id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Add Ingredient */}
          <div className="border rounded-md p-4 space-y-4">
            <h4 className="font-medium">Add Ingredient</h4>
            <div className="grid grid-cols-[2fr_1fr_auto] gap-2 items-end">
              <div className="grid gap-2">
                <Label htmlFor="ingredient">Ingredient</Label>
                <Select value={newIngredientId} onValueChange={setNewIngredientId}>
                  <SelectTrigger id="ingredient">
                    <SelectValue placeholder="Select ingredient" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableIngredients.map((ing) => (
                      <SelectItem key={ing.ingredient_id} value={ing.ingredient_id}>
                        {ing.name} ({ing.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <Button onClick={addIngredient} disabled={!newIngredientId || !newQuantity}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          {/* Stock Availability Warning */}
          {recipe.some((r) => {
            const ing = ingredients.find((i) => i.ingredient_id === r.ingredient_id);
            return ing && ing.on_hand < r.qty_per_item;
          }) && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-500 rounded-md p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-amber-500 text-amber-700">
                  At Risk
                </Badge>
                <span className="text-sm">
                  Some ingredients are low in stock. This item may become unavailable soon.
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Recipe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
