import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  FileText,
  RefreshCw,
  Trash2,
  Edit,
  ChefHat,
  ChevronDown,
  ChevronRight,
  Upload,
  X,
} from "lucide-react";
import { MenuItem } from "../types";
import { useState } from "react";
import Image from "next/image";

interface MenuItemListProps {
  menuItems: MenuItem[];
  loading: boolean;
  selectedItems: string[];
  editingItemId: string | null;
  editItemDraft: Partial<MenuItem> | null;
  expandedCategories: Set<string>;
  saving: string | null;
  onToggleSelectAll: () => void;
  onToggleSelectItem: (id: string) => void;
  onToggleCategoryExpansion: (category: string) => void;
  onSetEditingItemId: (id: string | null) => void;
  onSetEditItemDraft: (draft: Partial<MenuItem> | null) => void;
  onUpdateItem: (itemId: string, updates: Partial<MenuItem>) => void;
  onDeleteItem: (itemId: string) => void;
  onOpenRecipeDialog: (item: MenuItem) => void;
  getCategories: () => string[];
  getItemsByCategory: (category: string) => MenuItem[];
}

export function MenuItemList({
  menuItems,
  loading,
  selectedItems,
  editingItemId,
  editItemDraft,
  expandedCategories,
  saving,
  onToggleSelectAll,
  onToggleSelectItem,
  onToggleCategoryExpansion,
  onSetEditingItemId,
  onSetEditItemDraft,
  onUpdateItem,
  onDeleteItem,
  onOpenRecipeDialog,
  getCategories,
  getItemsByCategory,
}: MenuItemListProps) {
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  const handleImageUpload = async (itemId: string, file: File) => {
    setUploadingImage(itemId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("itemId", itemId);

      const response = await fetch("/api/menu-items/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      if (data.imageUrl) {
        onSetEditItemDraft({ ...editItemDraft, image_url: data.imageUrl });
      }
    } catch (error) {
      console.error("Image upload error:", error);
      alert("Failed to upload image");
    } finally {
      setUploadingImage(null);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Current Menu ({menuItems.length} items)</span>
        </CardTitle>
        <CardDescription>
          {menuItems.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={selectedItems.length === menuItems.length && menuItems.length > 0}
                onChange={onToggleSelectAll}
              />
              <span className="text-xs">Select All</span>
            </div>
          )}
          Edit or remove existing menu items. Changes are saved automatically and will be live for
          customers instantly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-900">Loading menu items...</p>
          </div>
        ) : menuItems.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-900 mb-4">
              No menu items found. Add some items above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {getCategories().map((category) => {
              const isExpanded = expandedCategories.has(category);
              const itemCount = getItemsByCategory(category).length;

              return (
                <div key={category} className="space-y-2">
                  <div
                    className="flex items-center justify-between cursor-pointer bg-gray-50 hover:bg-gray-100 px-4 py-3 rounded-lg border transition-colors"
                    onClick={() => onToggleCategoryExpansion(category)}
                  >
                    <div className="flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-900" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-900" />
                      )}
                      <h3 className="font-semibold text-lg text-servio-purple">{category}</h3>
                      <span className="text-sm text-gray-900">({itemCount} items)</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-3 ml-6">
                      {getItemsByCategory(category).map((item) => (
                        <div
                          key={item.id}
                          className="bg-white border border-gray-200 p-5 rounded-lg flex items-center justify-between shadow-sm hover:shadow-md group transition-all"
                        >
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(item.id)}
                            onChange={() => onToggleSelectItem(item.id)}
                            className="mr-4"
                          />
                          <div className="flex-1">
                            {editingItemId === item.id ? (
                              <div className="flex flex-col gap-3">
                                <div className="flex flex-col md:flex-row md:items-center gap-2">
                                  <Input
                                    value={editItemDraft?.name ?? item.name}
                                    onChange={(e) =>
                                      onSetEditItemDraft({ ...editItemDraft, name: e.target.value })
                                    }
                                    className="w-40"
                                    placeholder="Name"
                                  />
                                  <Input
                                    value={editItemDraft?.category ?? item.category}
                                    onChange={(e) =>
                                      onSetEditItemDraft({
                                        ...editItemDraft,
                                        category: e.target.value,
                                      })
                                    }
                                    className="w-32"
                                    placeholder="Category"
                                  />
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={editItemDraft?.price ?? item.price}
                                    onChange={(e) =>
                                      onSetEditItemDraft({
                                        ...editItemDraft,
                                        price: Number(e.target.value),
                                      })
                                    }
                                    className="w-24"
                                    placeholder="Price"
                                  />
                                  <Input
                                    value={editItemDraft?.description ?? item.description ?? ""}
                                    onChange={(e) =>
                                      onSetEditItemDraft({
                                        ...editItemDraft,
                                        description: e.target.value,
                                      })
                                    }
                                    className="w-48"
                                    placeholder="Description"
                                  />
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={editItemDraft?.is_available ?? item.is_available}
                                      onCheckedChange={(checked) =>
                                        onSetEditItemDraft({
                                          ...editItemDraft,
                                          is_available: checked,
                                        })
                                      }
                                    />
                                    <Label className="text-sm">
                                      {(editItemDraft?.is_available ?? item.is_available)
                                        ? "Available"
                                        : "Unavailable"}
                                    </Label>
                                  </div>
                                </div>

                                {/* Image Section */}
                                <div className="flex items-center gap-3">
                                  {(editItemDraft?.image_url || item.image_url) && (
                                    <div className="relative w-20 h-20">
                                      <Image
                                        src={editItemDraft?.image_url || item.image_url || ""}
                                        alt={item.name}
                                        fill
                                        className="object-cover rounded-lg"
                                      />
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full"
                                        onClick={() =>
                                          onSetEditItemDraft({ ...editItemDraft, image_url: null })
                                        }
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleImageUpload(item.id, file);
                                      }}
                                      disabled={uploadingImage === item.id}
                                      className="hidden"
                                      id={`image-upload-${item.id}`}
                                    />
                                    <Label
                                      htmlFor={`image-upload-${item.id}`}
                                      className="cursor-pointer"
                                    >
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={uploadingImage === item.id}
                                        onClick={() =>
                                          document
                                            .getElementById(`image-upload-${item.id}`)
                                            ?.click()
                                        }
                                      >
                                        {uploadingImage === item.id ? (
                                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                          <Upload className="h-4 w-4 mr-2" />
                                        )}
                                        {editItemDraft?.image_url || item.image_url
                                          ? "Change Image"
                                          : "Upload Image"}
                                      </Button>
                                    </Label>
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={async () => {
                                      if (!editItemDraft) return;
                                      if (
                                        !window.confirm(
                                          "Are you sure you want to save these changes?"
                                        )
                                      )
                                        return;
                                      await onUpdateItem(item.id, editItemDraft);
                                      onSetEditingItemId(null);
                                      onSetEditItemDraft(null);
                                    }}
                                    disabled={saving === item.id}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      onSetEditingItemId(null);
                                      onSetEditItemDraft(null);
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-3">
                                <h4 className="font-semibold text-lg">{item.name}</h4>
                                <span className="text-lg font-bold text-green-600">
                                  £{item.price.toFixed(2)}
                                </span>
                                <span className="text-xs text-gray-900">{item.category}</span>
                                {item.description && (
                                  <span className="text-xs text-gray-900">{item.description}</span>
                                )}
                                <span className="text-xs text-gray-900">
                                  {item.is_available ? "Available" : "Unavailable"}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-4">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeleteItem(item.id)}
                              disabled={saving === item.id}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              {saving === item.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onOpenRecipeDialog(item)}
                              className="text-purple-500 hover:text-purple-700 hover:bg-purple-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Manage Recipe"
                            >
                              <ChefHat className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                onSetEditingItemId(item.id);
                                onSetEditItemDraft({
                                  name: item.name,
                                  price: item.price,
                                  category: item.category,
                                  description: item.description,
                                  is_available: item.is_available,
                                  image_url: item.image_url,
                                });
                              }}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
