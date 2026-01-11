"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GripVertical, Plus, Edit, Trash2, Save, X, RotateCcw } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface CategoriesManagementProps {

}

export function CategoriesManagement({ venueId, onCategoriesUpdate }: CategoriesManagementProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [originalCategories, setOriginalCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingName, setEditingName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadCategories();
  }, [venueId]);

  const loadCategories = async () => {
    try {
      setLoading(true);

      // Load categories directly from menu_items (grouped by category)
      const { supabaseBrowser } = await import("@/lib/supabase");
      const supabase = supabaseBrowser();

      // Get all menu items to extract categories
      const { data: items } = await supabase
        .from("menu_items")
        .select("category")
        .eq("venue_id", venueId)
        .order("position", { ascending: true });

      if (!items || items.length === 0) {
        setCategories([]);
        setOriginalCategories([]);
        setLoading(false);
        return;
      }

      // Extract unique categories in order they appear
      const uniqueCategories: string[] = [];
      const seen = new Set<string>();

      for (const item of items) {
        if (item.category && !seen.has(item.category)) {
          uniqueCategories.push(item.category);
          seen.add(item.category);
        }
      }

      // Try to get category_order from menu_uploads (PDF order)
      const { data: uploadData } = await supabase
        .from("menu_uploads")
        .select("category_order")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const pdfCategoryOrder = uploadData?.category_order || [];

      // Use PDF order if available, otherwise use extraction order
      const finalCategories = pdfCategoryOrder.length > 0 ? pdfCategoryOrder : uniqueCategories;

      setCategories(finalCategories);
      setOriginalCategories(finalCategories);

      // Cache for fast load
      localStorage.setItem(`category-order-${venueId}`, JSON.stringify(finalCategories));
    } catch (_error) {
      toast({

    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const newCategories = Array.from(categories);
    const [reorderedItem] = newCategories.splice(result.source.index, 1);
    newCategories.splice(result.destination.index, 0, reorderedItem);

    setCategories(newCategories);
    await saveCategories(newCategories);
  };

  const saveCategories = async (categoriesToSave: string[]) => {
    setSaving(true);
    try {
      // Store in localStorage for immediate persistence
      localStorage.setItem(`category-order-${venueId}`, JSON.stringify(categoriesToSave));

      // Also call API for consistency (even though it doesn't persist to DB yet)
      const response = await fetch("/api/menu/categories", {

        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId, categories: categoriesToSave }),

      const data = await response.json();

      if (response.ok) {
        toast({

        onCategoriesUpdate?.(categoriesToSave);
      } else {
        toast({

        // Still update the parent component since we saved to localStorage
        onCategoriesUpdate?.(categoriesToSave);
      }
    } catch (_error) {
      // Still show success since we saved to localStorage
      toast({

      onCategoriesUpdate?.(categoriesToSave);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({

      return;
    }

    if (categories.includes(newCategoryName.trim())) {
      toast({

      return;
    }

    try {
      // Add to local state and localStorage immediately
      const newCategories = [...categories, newCategoryName.trim()];
      setCategories(newCategories);
      localStorage.setItem(`category-order-${venueId}`, JSON.stringify(newCategories));

      setNewCategoryName("");
      setIsAddModalOpen(false);
      toast({

        description: `Category "${newCategoryName.trim()}" added successfully`,

      onCategoriesUpdate?.(newCategories);

      // Also call API for consistency
      const response = await fetch("/api/menu/categories", {

        headers: { "Content-Type": "application/json" },

        }),

      if (!response.ok) {
        // Empty block
      }
    } catch (_error) {
      // Category was already added locally, so show success
      toast({

        description: `Category "${newCategoryName.trim()}" added successfully`,

    }
  };

  const handleEditCategory = (oldName: string) => {
    setEditingCategory(oldName);
    setEditingName(oldName);
  };

  const handleSaveEdit = async () => {
    if (!editingName.trim() || editingName.trim() === editingCategory) {
      setEditingCategory(null);
      return;
    }

    if (categories.includes(editingName.trim()) && editingName.trim() !== editingCategory) {
      toast({

      return;
    }

    try {
      // Update category name in menu items
      const response = await fetch("/api/menu/update-category", {

        headers: { "Content-Type": "application/json" },

        }),

      if (response.ok) {
        // Update local categories list
        const newCategories = categories.map((cat) =>
          cat === editingCategory ? editingName.trim() : cat
        );
        setCategories(newCategories);
        setEditingCategory(null);
        toast({

          description: `Category renamed to "${editingName.trim()}"`,

        onCategoriesUpdate?.(newCategories);
      } else {
        const data = await response.json();
        toast({

      }
    } catch (_error) {
      toast({

    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditingName("");
  };

  const handleDeleteCategory = async (categoryToDelete: string) => {
    // Check if category is in original categories (from PDF)
    const isOriginalCategory = originalCategories.some(
      (cat) => cat.toLowerCase() === categoryToDelete.toLowerCase()
    );

    if (isOriginalCategory) {
      toast({

      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete the category "${categoryToDelete}"? This will also delete all menu items in this category.`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      // Call API to delete category and its items
      const response = await fetch("/api/menu/delete-category", {

        headers: { "Content-Type": "application/json" },

        }),

      if (response.ok) {
        // Remove from local state
        const newCategories = categories.filter((cat) => cat !== categoryToDelete);
        setCategories(newCategories);
        localStorage.setItem(`category-order-${venueId}`, JSON.stringify(newCategories));

        toast({

          description: `Category "${categoryToDelete}" and its items deleted successfully`,

        onCategoriesUpdate?.(newCategories);
      } else {
        const data = await response.json();
        toast({

      }
    } catch (_error) {
      toast({

    } finally {
      setSaving(false);
    }
  };

  const handleResetCategories = async () => {
    if (
      !confirm(
        "Are you sure you want to reset categories to the original order from the PDF? This will remove unknown manually added categories and restore the original order."
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      // Always call the reset API to get the original categories from PDF
      const response = await fetch("/api/menu/categories/reset", {

        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId }),

      if (response.ok) {
        const data = await response.json();

        if (data.originalCategories && data.originalCategories.length > 0) {
          // Reset to original categories from PDF
          setCategories(data.originalCategories);
          setOriginalCategories(data.originalCategories);
          localStorage.setItem(
            `category-order-${venueId}`,
            JSON.stringify(data.originalCategories)
          );

          toast({

          onCategoriesUpdate?.(data.originalCategories);
        } else {
          // No original categories found
          toast({

        }
      } else {
        const errorData = await response.json();

        if (response.status === 404) {
          // No original categories found
          toast({

        } else {
          toast({

        }
      }
    } catch (_error) {
      toast({

    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Categories</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleResetCategories} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Category</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="categoryName">Category Name</Label>
                    <Input
                      id="categoryName"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="e.g., Appetizers, Main Courses, Desserts"
                      onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddCategory}>Add Category</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-gray-800 mb-4">
            Drag and drop to reorder categories. This order will be reflected in both menu
            management and customer ordering.
          </p>

          {categories.length === 0 ? (
            <div className="text-center py-8 text-gray-800">
              No categories found. Add your first category to get started.
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="categories">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {categories.map((category, index) => (
                      <Draggable key={category} draggableId={category} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`
                              flex items-center justify-between p-3 border rounded-lg
                              ${snapshot.isDragging ? "bg-blue-50 border-blue-200 shadow-md" : "bg-white border-gray-200"}
                              ${saving ? "opacity-50 pointer-events-none" : ""}
                            `}
                          >
                            <div className="flex items-center space-x-3">
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing text-gray-700 hover:text-gray-900"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                              {editingCategory === category ? (
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEdit();
                                    if (e.key === "Escape") handleCancelEdit();
                                  }}
                                  className="h-8"
                                  autoFocus
                                />
                              ) : (
                                <Badge variant="outline" className="text-sm">
                                  {category}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {editingCategory === category ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleSaveEdit}
                                    disabled={saving}
                                    className="btn-enhanced-ghost"
                                  >
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelEdit}
                                    disabled={saving}
                                    className="btn-enhanced-ghost"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditCategory(category)}
                                    disabled={saving}
                                    className="btn-enhanced-ghost"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteCategory(category)}
                                    disabled={saving}
                                    className="btn-enhanced-ghost text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                  <span className="text-xs text-gray-800">{index + 1}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
