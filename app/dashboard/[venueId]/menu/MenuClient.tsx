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
import NavBarClient from "@/components/NavBarClient";
import { supabase } from "@/lib/sb-client";
import { ArrowLeft, Plus, Edit, Trash2, ShoppingBag, Trash } from "lucide-react";
import Breadcrumbs from '@/components/Breadcrumbs';
import { MenuUploadCard } from "@/components/MenuUploadCard";
import { useToast } from "@/hooks/use-toast";
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

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
        setMenuItems(prev => [data, ...prev]);
      }
    }

    resetForm();
    setIsAddModalOpen(false);
  };

  const handleDelete = async (itemId: string) => {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', itemId)
      .eq('venue_id', venueId);

    if (!error) {
      setMenuItems(prev => prev.filter(item => item.id !== itemId));
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

  const handleClearMenu = async () => {
    if (!confirm('Are you sure you want to delete ALL menu items? This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      const response = await fetch('/api/menu/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue_id: venueId })
      });

      const result = await response.json();

      if (result.ok) {
        setMenuItems([]);
        toast({
          title: 'Menu cleared',
          description: 'All menu items have been deleted successfully'
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to clear menu items',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Clear menu error:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear menu items',
        variant: 'destructive'
      });
    } finally {
      setIsClearing(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBarClient />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBarClient />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb customBackPath={`/dashboard/${venueId}`} customBackLabel="Dashboard" venueId={venueId} />
        
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
            <p className="text-gray-600 mt-2">Manage menu items for {venueName} • {menuItems.length} total items</p>
          </div>
        </div>

        {/* Upload Menu */}
        <div className="mb-8">
          <MenuUploadCard venueId={venueId} onSuccess={loadMenuItems} />
        </div>

        {/* Action Buttons - Positioned between upload and menu items */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={loadMenuItems}
              disabled={loading}
            >
              Refresh
            </Button>
            {menuItems.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleClearMenu}
                disabled={isClearing}
              >
                <Trash className="h-4 w-4 mr-2" />
                {isClearing ? 'Clearing...' : 'Clear Menu'}
              </Button>
            )}
          </div>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
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

        {/* Menu Items Grid */}
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
            // Group items by category with proper ordering
            (() => {
              const groupedItems = menuItems.reduce((acc: { [key: string]: MenuItem[] }, item) => {
                const category = item.category || 'Uncategorized';
                if (!acc[category]) {
                  acc[category] = [];
                }
                acc[category].push(item);
                return acc;
              }, {});

                            // Define category priority order to match PDF structure
              const categoryPriority = [
                "starters", "starter", "appetizers", "appetizer", "entrees", "main courses", "main course", 
                "mains", "main", "salads", "salad", "sides", "side dishes", "desserts", "dessert", 
                "drinks", "beverages", "coffee", "tea", "wine", "beer", "cocktails", "soft drinks"
              ];

              // Sort categories based on priority and creation order
              const sortedCategories = Object.entries(groupedItems).sort(([catA], [catB]) => {
                const priorityA = categoryPriority.findIndex(priority => 
                  catA.toLowerCase().includes(priority.toLowerCase())
                );
                const priorityB = categoryPriority.findIndex(priority => 
                  catB.toLowerCase().includes(priority.toLowerCase())
                );
                
                // If both categories have priority, sort by priority
                if (priorityA >= 0 && priorityB >= 0) {
                  return priorityA - priorityB;
                }
                
                // If only one has priority, prioritize it
                if (priorityA >= 0) return -1;
                if (priorityB >= 0) return 1;
                
                // If neither has priority, sort alphabetically
                return catA.localeCompare(catB);
              });

              return sortedCategories.map(([category, items]) => (
                <div key={category} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">{category}</h2>
                    <span className="text-sm text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid gap-4">
                    {items.map((item) => (
                      <Card key={item.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h3 className="text-lg font-semibold">{item.name}</h3>
                                <span className="text-lg font-bold text-green-600">
                                  £{item.price.toFixed(2)}
                                </span>
                              </div>
                              {item.description && (
                                <p className="text-gray-600 text-sm mb-2">{item.description}</p>
                              )}
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={item.available}
                                    onCheckedChange={(checked) => handleToggleAvailable(item.id, checked)}
                                  />
                                  <span className="text-sm text-gray-600">
                                    {item.available ? 'Available' : 'Unavailable'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditModal(item)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(item.id)}
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
    </div>
  );
}
