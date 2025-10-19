import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, RefreshCw } from "lucide-react";
import { NewItem } from '../types';

interface AddMenuItemSectionProps {
  newItem: NewItem;
  setNewItem: (item: NewItem) => void;
  onAddItem: () => void;
  saving: string | null;
  loading: boolean;
  categories: string[];
}

export function AddMenuItemSection({
  newItem,
  setNewItem,
  onAddItem,
  saving,
  loading,
  categories,
}: AddMenuItemSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Menu Items</CardTitle>
        <CardDescription>
          Add individual menu items to your venue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Item Name *</Label>
            <Input
              id="name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="e.g., Cappuccino"
              disabled={saving === "add"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Input
              id="category"
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              placeholder="e.g., Coffee"
              disabled={saving === "add"}
              list="categories"
            />
            <datalist id="categories">
              {categories.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price">Price (£) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={newItem.price}
              onChange={(e) => setNewItem({ ...newItem, price: Number.parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              disabled={saving === "add"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="available">Availability</Label>
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="available"
                checked={newItem.available}
                onCheckedChange={(checked) => setNewItem({ ...newItem, available: checked })}
                disabled={saving === "add"}
              />
              <Label htmlFor="available">Available for ordering</Label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            placeholder="Optional description of the item"
            disabled={saving === "add"}
          />
        </div>

        <Button
          onClick={onAddItem}
          disabled={saving === "add" || loading}
          className="w-full"
          data-add-item-button
        >
          {saving === "add" ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlusCircle className="mr-2 h-4 w-4" />
          )}
          Add Item
        </Button>
      </CardContent>
    </Card>
  );
}

