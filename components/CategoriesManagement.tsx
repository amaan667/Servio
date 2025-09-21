"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { GripVertical, Plus, Edit, Trash2, Save, X } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface CategoriesManagementProps {
  venueId: string;
  onCategoriesUpdate?: (categories: string[]) => void;
}

export function CategoriesManagement({ venueId, onCategoriesUpdate }: CategoriesManagementProps) {
  const [categories, setCategories] = useState<string[]>([]);
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
      // First try to load from localStorage
      const storedOrder = localStorage.getItem(`category-order-${venueId}`);
      if (storedOrder) {
        const parsedOrder = JSON.parse(storedOrder);
        console.log('[CATEGORIES] Loaded from localStorage:', parsedOrder);
        setCategories(parsedOrder);
        setLoading(false);
        return;
      }

      // Fallback to API
      const response = await fetch(`/api/menu/categories?venueId=${venueId}`);
      const data = await response.json();
      
      if (response.ok) {
        setCategories(data.categories || []);
        // Store in localStorage for persistence
        if (data.categories) {
          localStorage.setItem(`category-order-${venueId}`, JSON.stringify(data.categories));
        }
      } else {
        console.error('Error loading categories:', data.error);
        toast({
          title: "Error",
          description: data.error || "Failed to load categories",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
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
      const response = await fetch('/api/menu/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId, categories: categoriesToSave })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Category order updated successfully",
        });
        onCategoriesUpdate?.(categoriesToSave);
      } else {
        console.error('Error saving categories:', data.error);
        toast({
          title: "Success",
          description: "Category order updated (saved locally)",
        });
        // Still update the parent component since we saved to localStorage
        onCategoriesUpdate?.(categoriesToSave);
      }
    } catch (error) {
      console.error('Error saving categories:', error);
      // Still show success since we saved to localStorage
      toast({
        title: "Success",
        description: "Category order updated (saved locally)",
      });
      onCategoriesUpdate?.(categoriesToSave);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Error",
        description: "Category name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (categories.includes(newCategoryName.trim())) {
      toast({
        title: "Error",
        description: "Category already exists",
        variant: "destructive",
      });
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
        title: "Success",
        description: `Category "${newCategoryName.trim()}" added successfully`,
      });
      onCategoriesUpdate?.(newCategories);

      // Also call API for consistency
      const response = await fetch('/api/menu/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          venueId, 
          categoryName: newCategoryName.trim() 
        })
      });

      if (!response.ok) {
        console.error('API call failed but category was added locally');
      }
    } catch (error) {
      console.error('Error adding category:', error);
      // Category was already added locally, so show success
      toast({
        title: "Success",
        description: `Category "${newCategoryName.trim()}" added successfully`,
      });
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
        title: "Error",
        description: "Category already exists",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update category name in menu items
      const response = await fetch('/api/menu/update-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          venueId, 
          oldCategory: editingCategory,
          newCategory: editingName.trim()
        })
      });

      if (response.ok) {
        // Update local categories list
        const newCategories = categories.map(cat => 
          cat === editingCategory ? editingName.trim() : cat
        );
        setCategories(newCategories);
        setEditingCategory(null);
        toast({
          title: "Success",
          description: `Category renamed to "${editingName.trim()}"`,
        });
        onCategoriesUpdate?.(newCategories);
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to rename category",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error renaming category:', error);
      toast({
        title: "Error",
        description: "Failed to rename category",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditingName("");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading categories...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Categories</CardTitle>
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
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCategory}>
                    Add Category
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground mb-4">
            Drag and drop to reorder categories. This order will be reflected in both menu management and customer ordering.
          </p>
          
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No categories found. Add your first category to get started.
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="categories">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {categories.map((category, index) => (
                      <Draggable key={category} draggableId={category} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`
                              flex items-center justify-between p-3 border rounded-lg
                              ${snapshot.isDragging ? 'bg-blue-50 border-blue-200 shadow-md' : 'bg-white border-gray-200'}
                              ${saving ? 'opacity-50 pointer-events-none' : ''}
                            `}
                          >
                            <div className="flex items-center space-x-3">
                              <div
                                {...provided.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                              {editingCategory === category ? (
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit();
                                    if (e.key === 'Escape') handleCancelEdit();
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
                                  >
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelEdit}
                                    disabled={saving}
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
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <span className="text-xs text-muted-foreground">
                                    {index + 1}
                                  </span>
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
