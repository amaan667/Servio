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
import { createClient } from "@/lib/supabase/client";
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
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);
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

  // Handle venue ID format - try both with and without 'venue-' prefix
  const transformedVenueId = venueId.startsWith('venue-') ? venueId.substring(6) : venueId;
  const originalVenueId = venueId; // Keep original for fallback

  useEffect(() => {
    loadMenuItems();
  }, [venueId]);

  const loadMenuItems = async () => {
    try {
      const supabase = createClient();
      // Try both venue ID formats to find menu items
      let { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('venue_id', transformedVenueId)
        .order('category', { ascending: true })
        .order('order_index', { ascending: true })
        .order('name', { ascending: true });

      // If no items found with transformed ID, try with original ID
      if (!data || data.length === 0) {
        console.log('[MENU CLIENT] No items found with transformed ID, trying original ID:', originalVenueId);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('menu_items')
          .select('*')
          .eq('venue_id', originalVenueId)
          .order('category', { ascending: true })
          .order('order_index', { ascending: true })
          .order('name', { ascending: true });
        
        if (fallbackData && fallbackData.length > 0) {
          data = fallbackData;
          error = fallbackError;
          console.log('[MENU CLIENT] Found', fallbackData.length, 'items with original venue ID');
        }
      }

      // Fetch the most recent menu upload to get category order - try both venue ID formats
      let { data: uploadData, error: uploadError } = await supabase
        .from('menu_uploads')
        .select('parsed_json')
        .eq('venue_id', transformedVenueId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // If no upload data found with transformed ID, try with original ID
      if (!uploadData && !uploadError) {
        console.log('[MENU CLIENT] No upload data found with transformed ID, trying original ID');
        const { data: fallbackUploadData, error: fallbackUploadError } = await supabase
          .from('menu_uploads')
          .select('parsed_json')
          .eq('venue_id', originalVenueId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (fallbackUploadData) {
          uploadData = fallbackUploadData;
          uploadError = fallbackUploadError;
          console.log('[MENU CLIENT] Found upload data with original venue ID');
        }
      }

      if (!error && data) {
        setMenuItems(data);
        console.log('[MENU CLIENT] Successfully loaded', data.length, 'menu items');
        
        // Extract categories from the parsed_json
        if (uploadData?.parsed_json && uploadData.parsed_json.categories) {
          // Categories are stored as an array of strings in the correct PDF order
          const categories = uploadData.parsed_json.categories;
          console.log('[MENU CLIENT] Retrieved categories:', categories);
          setCategoryOrder(categories);
        } else {
          console.log('[MENU CLIENT] No categories found in parsed_json:', uploadData?.parsed_json);
          console.log('[MENU CLIENT] Upload error:', uploadError);
          console.log('[MENU CLIENT] Venue ID being used:', transformedVenueId);
          
          // Try to get more details about the upload error
          if (uploadError) {
            console.log('[MENU CLIENT] Upload error details:', {
              message: uploadError.message,
              code: uploadError.code,
              details: uploadError.details,
              hint: uploadError.hint
            });
            console.log('[MENU CLIENT] Full upload error object:', uploadError);
          }
          
          console.log('[MENU CLIENT] Will use categoryPriority array as fallback for ordering');
          setCategoryOrder(null);
        }
      } else if (error) {
        console.error('[MENU CLIENT] Error loading menu items:', error);
        toast({
          title: "Error",
          description: "Failed to load menu items",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('[MENU CLIENT] Unexpected error:', err);
      toast({
        title: "Error",
        description: "Failed to load menu items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
      const supabase = createClient();
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
      const supabase = createClient();
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
    const supabase = createClient();
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
    const supabase = createClient();
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
      const response = await fetch('/api/catalog/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId: venueId })
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading menu items...</div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Menu Stats */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{menuItems.length} menu items</span>
            </div>
            <span className="text-sm text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">
              {menuItems.filter(item => item.available).length} available
            </span>
          </div>
          <div className="flex items-center space-x-2">
          </div>
        </div>

        {/* Upload Menu */}
        <div className="mb-8">
          <MenuUploadCard venueId={venueId} onSuccess={loadMenuItems} />
        </div>

        {/* Action Buttons - Positioned between upload and menu items */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Clear Menu button removed - now only in MenuUploadCard */}
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

                            // Define category priority order to match PDF structure (NUR CAFE menu order)
              const categoryPriority = [
                "starters", "starter", "appetizers", "appetizer",
                "all day brunch", "brunch", "breakfast",
                "kids", "children", "child",
                "mains", "main", "main courses", "main course", "entrees", "burgers", "burger",
                "fries", "fry", "chips", "side dishes", "sides", 
                "extras", "extra", "add-ons", "add ons", "addons",
                "sauces", "sauce", "condiments", "condiment",
                "salads", "salad", "desserts", "dessert", 
                "drinks", "beverages", "coffee", "tea", "wine", "beer", "cocktails", "soft drinks"
              ];

              // Sort categories based on stored order from PDF upload
              const sortedCategories = Object.entries(groupedItems).sort(([catA], [catB]) => {
                // Check if we have stored category order from PDF upload
                if (categoryOrder && Array.isArray(categoryOrder)) {
                  const orderA = categoryOrder.findIndex(storedCat => 
                    storedCat.toLowerCase() === catA.toLowerCase()
                  );
                  const orderB = categoryOrder.findIndex(storedCat => 
                    storedCat.toLowerCase() === catB.toLowerCase()
                  );
                  
                  // If both categories are in stored order, sort by that order
                  if (orderA >= 0 && orderB >= 0) {
                    return orderA - orderB;
                  }
                  
                  // If only one is in stored order, prioritize it
                  if (orderA >= 0) return -1;
                  if (orderB >= 0) return 1;
                }
                
                // Fallback to alphabetical sorting for categories not in stored order
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
