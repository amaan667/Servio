"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { MenuItem } from "../types";

interface MenuItemFormProps {

  };

    }>
  >;

}

export function MenuItemForm({
  formData,
  setFormData,
  editingItem,
  onSubmit,
  onCancel,
}: MenuItemFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Item Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Margherita Pizza"
          required
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the item..."
          rows={3}
        />
      </div>
      <div>
        <Label htmlFor="price">Price (£)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            £
          </span>
          <Input
            id="price"
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            placeholder="0.00"
            className="pl-8"
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="e.g., Pizza, Drinks, Desserts"
          required
        />
      </div>
      <div className="flex items-center space-x-2">
        <ToggleSwitch
          checked={formData.available}
          onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
        />
        <Label>Available</Label>
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          <Save className="h-4 w-4 mr-2" />
          {editingItem ? "Update" : "Add"} Item
        </Button>
      </div>
    </form>
  );
}
