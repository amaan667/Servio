"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Plus, Edit, Trash2, ShoppingBag, Trash } from "lucide-react";
import { MenuUploadCard } from "@/components/MenuUploadCard";
import { useToast } from "@/hooks/use-toast";


interface MenuItem {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  available: boolean;
  created_at: string;
}

export default function MenuClient({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    available: true
  });
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    loadMenuItems();
  }, [venueId]);

  const loadMenuItems = async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', venueId)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (!error && data) {
      setMenuItems(data);
    } else if (error) {
      console.error('Error loading menu items:', error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const itemData = {
      venue_id: venueId,
      name: formData.name,
      description: formData.description || null,
      price: parseFloat(formData.price),
      category: formData.category,
      available: formData.available
    };

    if (editingItem) {
      // Update existing item
      const { error } = await supabase
        .from('menu_items')
        .update(itemData)
        .eq('id', editingItem.id)
        .eq('venue_id', venueId);

      if (!error) {
        setMenuItems(prev => prev.map(item => 
          item.id === editingItem.id ? { ...item, ...itemData } : item
        ));
        setEditingItem(null);
      }
    } else {
      // Add new item
      const { data, error } = await supabase
        .from('menu_items')
        .insert([itemData])
        .select()
        .single();

      if (!error && data) {
        setMenuItems(prev => [...prev, data]);
      }
    }

    if (!error) {
      toast({
        title: editingItem ? 'Menu item updated' : 'Menu item added',
        description: editingItem ? 'The menu item has been updated successfully.' : 'The menu item has been added successfully.',
      });
      setIsAddModalOpen(false);
      resetForm();
    } else {
      toast({
        title: 'Error',
        description: 'Failed to save menu item. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (itemId: string) => {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', itemId)
      .eq('venue_id', venueId);

    if (!error) {
      setMenuItems(prev => prev.filter(item => item.id !== itemId));
      toast({
        title: 'Menu item deleted',
        description: 'The menu item has been deleted successfully.',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to delete menu item. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleAvailable = async (itemId: string, available: boolean) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ available })
      .eq('id', itemId)
      .eq('venue_id', venueId);

    if (!error) {
      setMenuItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, available } : item
      ));
    }
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category: item.category,
      available: item.available
    });
    setIsAddModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      available: true
    });
    setEditingItem(null);
  };

  const handleClearMenu = async () => {
    setIsClearing(true);
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('venue_id', venueId);

    if (!error) {
      setMenuItems([]);
      toast({
        title: 'Menu cleared',
        description: 'All menu items have been removed.',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to clear menu. Please try again.',
        variant: 'destructive',
      });
    }
    setIsClearing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Menu Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">Manage menu items for {venueName} • {menuItems.length} total items</p>
        </div>
      </div>

      {/* Upload Menu */}
      <div className="mb-8">
        <MenuUploadCard venueId={venueId} onSuccess={loadMenuItems} />
      </div>

      {/* Action Buttons */}
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={loadMenuItems}
            disabled={loading}
            size="sm"
          >
            Refresh
          </Button>
          {menuItems.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={handleClearMenu}
              disabled={isClearing}
              size="sm"
            >
              <Trash className="h-4 w-4 mr-2" />
              {isClearing ? 'Clearing...' : 'Clear Menu'}
            </Button>
          )}
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="price">Price (£) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Beverages, Main Courses, Desserts"
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="available"
                  checked={formData.available}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, available: checked }))}
                />
                <Label htmlFor="available">Available</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingItem ? 'Update' : 'Add'} Item
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Menu Items */}
      <div className="space-y-6">
        {menuItems.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Menu Items</h3>
              <p className="text-gray-500 mb-4">Add your first menu item to get started</p>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Item
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Group items by category
          (() => {
            const groupedItems = menuItems.reduce((acc: { [key: string]: MenuItem[] }, item) => {
              const category = item.category || 'Uncategorized';
              if (!acc[category]) {
                acc[category] = [];
              }
              acc[category].push(item);
              return acc;
            }, {});

            // Sort categories alphabetically
            const sortedCategories = Object.entries(groupedItems).sort(([catA], [catB]) => 
              catA.toLowerCase().localeCompare(catB.toLowerCase())
            );

            return sortedCategories.map(([category, items]) => (
              <div key={category} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{category}</h2>
                  <span className="text-xs sm:text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="grid gap-4">
                  {items.map((item) => (
                    <Card key={item.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                              <h3 className="text-base sm:text-lg font-semibold truncate">{item.name}</h3>
                              <span className="text-base sm:text-lg font-bold text-green-600">
                                £{item.price.toFixed(2)}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-gray-600 text-xs sm:text-sm mb-2 line-clamp-2">{item.description}</p>
                            )}
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center space-x-2">
                                <Switch
                                  checked={item.available}
                                  onCheckedChange={(checked) => handleToggleAvailable(item.id, checked)}
                                />
                                <span className="text-xs sm:text-sm text-gray-600">
                                  {item.available ? 'Available' : 'Unavailable'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex space-x-2 self-end sm:self-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditModal(item)}
                              className="p-2"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(item.id)}
                              className="p-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ));
          })()
        )}
      </div>
    </div>
  );
}
