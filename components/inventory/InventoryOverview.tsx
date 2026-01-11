"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreVertical, Download, Upload, Search, AlertTriangle } from "lucide-react";
import type { StockLevel } from "@/types/inventory";
import { AddIngredientDialog } from "./AddIngredientDialog";
import { StockAdjustmentDialog } from "./StockAdjustmentDialog";
import { StocktakeDialog } from "./StocktakeDialog";
import { ImportCSVDialog } from "./ImportCSVDialog";
import { ReceiveStockDialog } from "./ReceiveStockDialog";

interface InventoryOverviewProps {
  venueId: string;
  canEdit?: boolean;
}

export function InventoryOverview({ venueId, canEdit: _canEdit = true }: InventoryOverviewProps) {
  const [ingredients, setIngredients] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showStocktakeDialog, setShowStocktakeDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<StockLevel | null>(null);

  const fetchIngredients = async () => {
    try {
      const response = await fetch(`/api/inventory/ingredients?venue_id=${venueId}`);
      const result = await response.json();
      if (result.data) {
        setIngredients(result.data);
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngredients();
  }, [venueId]);

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`/api/inventory/export/csv?venue_id=${venueId}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory-${venueId}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (_error) {
      // Error silently handled
    }
  };

  const handleReceiveStock = (ingredient: StockLevel) => {
    setSelectedIngredient(ingredient);
    setShowReceiveDialog(true);
  };

  const handleAdjustStock = (ingredient: StockLevel, _reason: "adjust" | "waste") => {
    setSelectedIngredient(ingredient);
    setShowAdjustDialog(true);
  };

  const handleStocktake = (ingredient: StockLevel) => {
    setSelectedIngredient(ingredient);
    setShowStocktakeDialog(true);
  };

  const handleDelete = async (ingredientId: string) => {
    if (!confirm("Are you sure you want to delete this ingredient?")) return;

    try {
      const response = await fetch(`/api/inventory/ingredients/${ingredientId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchIngredients();
      }
    } catch (_error) {
      // Error silently handled
    }
  };

  const filteredIngredients = ingredients.filter(
    (ing) =>
      ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ing.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockCount = ingredients.filter(
    (ing) => ing.on_hand <= ing.reorder_level && ing.reorder_level > 0
  ).length;

  return (
    <div className="space-y-4">
      {lowStockCount > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-amber-900 dark:text-amber-100">Low Stock Alert</CardTitle>
            </div>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              {lowStockCount} ingredient{lowStockCount > 1 ? "s" : ""} at or below reorder level
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Ingredients</CardTitle>
              <CardDescription>Manage your ingredient inventory</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowImportDialog(true)} variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button onClick={handleExportCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={() => setShowAddDialog(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Ingredient
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading ingredients...</div>
          ) : filteredIngredients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No ingredients found. Add your first ingredient to get started.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>On Hand</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Par Level</TableHead>
                    <TableHead>Reorder</TableHead>
                    <TableHead>Cost/Unit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIngredients.map((ingredient) => {
                    const isLowStock =
                      ingredient.on_hand <= ingredient.reorder_level &&
                      ingredient.reorder_level > 0;
                    const isOutOfStock = ingredient.on_hand <= 0;

                    return (
                      <TableRow
                        key={ingredient.ingredient_id}
                        className={
                          isOutOfStock
                            ? "bg-red-50 dark:bg-red-950"
                            : isLowStock
                              ? "bg-amber-50 dark:bg-amber-950"
                              : ""
                        }
                      >
                        <TableCell className="font-medium">
                          {ingredient.name}
                          {isOutOfStock && (
                            <Badge variant="destructive" className="ml-2">
                              Out
                            </Badge>
                          )}
                          {isLowStock && !isOutOfStock && (
                            <Badge
                              variant="outline"
                              className="ml-2 border-amber-500 text-amber-700"
                            >
                              Low
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{ingredient.sku || "-"}</TableCell>
                        <TableCell
                          className={
                            isOutOfStock
                              ? "font-bold text-red-600"
                              : isLowStock
                                ? "font-bold text-amber-600"
                                : ""
                          }
                        >
                          {ingredient.on_hand}
                        </TableCell>
                        <TableCell>{ingredient.unit}</TableCell>
                        <TableCell>{ingredient.par_level}</TableCell>
                        <TableCell>{ingredient.reorder_level}</TableCell>
                        <TableCell>${ingredient.cost_per_unit}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleReceiveStock(ingredient)}>
                                Receive (+)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAdjustStock(ingredient, "adjust")}
                              >
                                Adjust (±)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAdjustStock(ingredient, "waste")}
                              >
                                Waste (-)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStocktake(ingredient)}>
                                Stocktake
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(ingredient.ingredient_id)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddIngredientDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        venueId={venueId}
        onSuccess={fetchIngredients}
      />

      {selectedIngredient && (
        <>
          <ReceiveStockDialog
            open={showReceiveDialog}
            onOpenChange={setShowReceiveDialog}
            ingredient={selectedIngredient}
            onSuccess={fetchIngredients}
          />

          <StockAdjustmentDialog
            open={showAdjustDialog}
            onOpenChange={setShowAdjustDialog}
            ingredient={selectedIngredient}
            onSuccess={fetchIngredients}
          />

          <StocktakeDialog
            open={showStocktakeDialog}
            onOpenChange={setShowStocktakeDialog}
            ingredient={selectedIngredient}
            onSuccess={fetchIngredients}
          />
        </>
      )}

      <ImportCSVDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        venueId={venueId}
        onSuccess={fetchIngredients}
      />
    </div>
  );
}
