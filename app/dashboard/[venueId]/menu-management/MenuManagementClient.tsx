"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { Plus, Edit, Trash2, ShoppingBag, Trash, ChevronDown, ChevronRight, Save, Eye, Download, Palette, Layout, Settings, Upload, Image, Palette as PaletteIcon, Type, Grid, List, Share } from "lucide-react";
import { MenuUploadCard } from "@/components/MenuUploadCard";
import { CategoriesManagement } from "@/components/CategoriesManagement";
import { useToast } from "@/hooks/use-toast";
import { formatPriceWithCurrency } from "@/lib/pricing-utils";

interface MenuItem {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  is_available: boolean;
  created_at: string;
}

interface DesignSettings {
  venue_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  font_size: string;
  show_descriptions: boolean;
  show_prices: boolean;
}

export default function MenuManagementClient({ venueId }: { venueId: string }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[] | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    available: true
  });
  const [isClearing, setIsClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<'manage' | 'design' | 'preview'>('manage');
  const [showCategories, setShowCategories] = useState(false);
  const [designSettings, setDesignSettings] = useState<DesignSettings>({
    venue_name: '',
    logo_url: null,
    primary_color: '#8b5cf6',
    secondary_color: '#f3f4f6',
    font_family: 'inter',
    font_size: 'medium',
    show_descriptions: true,
    show_prices: true
  });
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSavingDesign, setIsSavingDesign] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (venueId) {
      loadMenuItems();
      loadDesignSettings();
    }
  }, [venueId]);

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: items, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading menu items:', error);
        toast({
          title: "Error",
          description: "Failed to load menu items",
          variant: "destructive",
        });
        return;
      }

      setMenuItems(items || []);
      
      // Load category order
      const { data: uploadData, error: uploadError } = await supabase
        .from('menu_uploads')
        .select('category_order')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!uploadError && uploadData && uploadData.length > 0) {
        setCategoryOrder(uploadData[0].category_order);
      }
    } catch (error) {
      console.error('Error in loadMenuItems:', error);
      toast({
        title: "Error",
        description: "Failed to load menu items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDesignSettings = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('menu_design_settings')
        .select('*')
        .eq('venue_id', venueId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading design settings:', error);
        return;
      }

      if (data) {
        setDesignSettings({
          venue_name: data.venue_name || '',
          logo_url: data.logo_url,
          primary_color: data.primary_color || '#8b5cf6',
          secondary_color: data.secondary_color || '#f3f4f6',
          font_family: data.font_family || 'inter',
          font_size: data.font_size || 'medium',
          show_descriptions: data.show_descriptions ?? true,
          show_prices: data.show_prices ?? true
        });
      }
    } catch (error) {
      console.error('Error in loadDesignSettings:', error);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploadingLogo(true);
      const supabase = createClient();

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${venueId}/logo-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('venue-assets')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('venue-assets')
        .getPublicUrl(fileName);

      // Update design settings with new logo URL
      setDesignSettings(prev => ({
        ...prev,
        logo_url: urlData.publicUrl
      }));

      toast({
        title: "Logo uploaded successfully",
        description: "Your logo has been uploaded and will appear in the preview.",
      });

    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const saveDesignSettings = async () => {
    try {
      setIsSavingDesign(true);
      const supabase = createClient();

      const { error } = await supabase
        .from('menu_design_settings')
        .upsert({
          venue_id: venueId,
          ...designSettings,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Design saved successfully",
        description: "Your design settings have been saved and will appear in the preview.",
      });

    } catch (error: any) {
      console.error('Error saving design settings:', error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save design settings",
        variant: "destructive",
      });
    } finally {
      setIsSavingDesign(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!venueId) {
      toast({
        title: "Error",
        description: "Venue not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const supabase = createClient();
      const itemData = {
        venue_id: venueId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price),
        category: formData.category.trim(),
        is_available: formData.available,
        created_at: new Date().toISOString()
      };

      let result;
      if (editingItem) {
        result = await supabase
          .from('menu_items')
          .update(itemData)
          .eq('id', editingItem.id);
      } else {
        result = await supabase
          .from('menu_items')
          .insert(itemData);
      }

      if (result.error) {
        throw result.error;
      }

      toast({
        title: editingItem ? "Menu item updated" : "Menu item added",
        description: `"${formData.name}" has been ${editingItem ? 'updated' : 'added'} successfully.`,
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        price: '',
        category: '',
        available: true
      });
      setIsAddModalOpen(false);
      setEditingItem(null);
      
      // Reload menu items
      await loadMenuItems();
    } catch (error: any) {
      console.error('Error saving menu item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save menu item",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', item.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Menu item deleted",
        description: `"${item.name}" has been deleted successfully.`,
      });

      await loadMenuItems();
    } catch (error: any) {
      console.error('Error deleting menu item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete menu item",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category: item.category,
      available: item.is_available
    });
    setIsAddModalOpen(true);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategories = () => {
    const categories = Array.from(new Set(menuItems.map(item => item.category)));
    if (categoryOrder) {
      return categoryOrder.filter(cat => categories.includes(cat));
    }
    return categories.sort();
  };

  const getItemsByCategory = (category: string) => {
    return menuItems.filter(item => item.category === category);
  };

  const clearAllMenu = async () => {
    if (!confirm('Are you sure you want to clear all menu items? This action cannot be undone.')) {
      return;
    }

    try {
      setIsClearing(true);
      const supabase = createClient();
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('venue_id', venueId);

      if (error) {
        throw error;
      }

      toast({
        title: "Menu cleared",
        description: "All menu items have been cleared successfully.",
      });

      await loadMenuItems();
    } catch (error: any) {
      console.error('Error clearing menu:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to clear menu",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading menu items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-1 mb-6 bg-muted p-1 rounded-lg w-full sm:w-fit">
        <Button
          variant={activeTab === 'manage' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('manage')}
          className="flex items-center justify-center space-x-2 w-full sm:w-auto"
        >
          <Settings className="h-4 w-4" />
          <span>Manage</span>
        </Button>
        <Button
          variant={activeTab === 'design' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('design')}
          className="flex items-center justify-center space-x-2 w-full sm:w-auto"
        >
          <Palette className="h-4 w-4" />
          <span>Design</span>
        </Button>
        <Button
          variant={activeTab === 'preview' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('preview')}
          className="flex items-center justify-center space-x-2 w-full sm:w-auto"
        >
          <Eye className="h-4 w-4" />
          <span>Preview</span>
        </Button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          {/* Upload Menu Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="h-5 w-5" />
                <span>Upload Menu</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MenuUploadCard venueId={venueId} onSuccess={() => loadMenuItems()} />
            </CardContent>
          </Card>

          {/* Categories Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Grid className="h-5 w-5" />
                  <span>Categories</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowCategories(!showCategories)}
                  className="flex items-center space-x-2"
                >
                  {showCategories ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span>{showCategories ? 'Hide' : 'Manage'}</span>
                </Button>
              </CardTitle>
            </CardHeader>
            {showCategories && (
              <CardContent>
                <CategoriesManagement venueId={venueId} onCategoriesUpdate={() => loadMenuItems()} />
              </CardContent>
            )}
          </Card>

          {/* Menu Items Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="h-5 w-5" />
                  <span>Menu Items ({menuItems.length})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center space-x-2">
                        <Plus className="h-4 w-4" />
                        <span>Add Item</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="name">Item Name</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            placeholder="e.g., Margherita Pizza"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            placeholder="Describe the item..."
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label htmlFor="price">Price (£)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">£</span>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            value={formData.price}
                            onChange={(e) => setFormData({...formData, price: e.target.value})}
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
                            onChange={(e) => setFormData({...formData, category: e.target.value})}
                            placeholder="e.g., Pizza, Drinks, Desserts"
                            required
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <ToggleSwitch
                            checked={formData.available}
                            onCheckedChange={(checked) => setFormData({...formData, available: checked})}
                          />
                          <Label>Available</Label>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">
                            <Save className="h-4 w-4 mr-2" />
                            {editingItem ? 'Update' : 'Add'} Item
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  {menuItems.length > 0 && (
                    <Button
                      variant="destructive"
                      onClick={clearAllMenu}
                      disabled={isClearing}
                      className="flex items-center space-x-2"
                    >
                      <Trash className="h-4 w-4" />
                      <span>{isClearing ? 'Clearing...' : 'Clear All'}</span>
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {menuItems.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No menu items yet</h3>
                  <p className="text-muted-foreground mb-4">Get started by adding your first menu item or uploading a menu.</p>
                  <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Add First Item</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {getCategories().map(category => (
                    <div key={category} className="border rounded-lg">
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="flex items-center space-x-2">
                          {expandedCategories.has(category) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <h3 className="font-medium text-foreground">{category}</h3>
                          <span className="text-sm text-muted-foreground">
                            ({getItemsByCategory(category).length} items)
                          </span>
                        </div>
                      </div>
                      {expandedCategories.has(category) && (
                        <div className="border-t">
                          {getItemsByCategory(category).map(item => (
                            <div key={item.id} className="flex items-center justify-between p-4 hover:bg-muted/25">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium text-foreground">{item.name}</h4>
                                  {!item.is_available && (
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Unavailable</span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                                )}
                                <p className="text-sm font-medium text-foreground mt-1">{formatPriceWithCurrency(item.price, '£')}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(item)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(item)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'design' && (
        <div className="space-y-6">
          {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PaletteIcon className="h-5 w-5" />
                <span>Theme & Colors</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      type="color"
                      id="primary-color"
                      value={designSettings.primary_color}
                      onChange={(e) => setDesignSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                      className="w-12 h-10 rounded border border-gray-300"
                    />
                    <Input 
                      value={designSettings.primary_color}
                      onChange={(e) => setDesignSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                      placeholder="#8b5cf6" 
                      className="flex-1" 
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="secondary-color">Secondary Color</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      type="color"
                      id="secondary-color"
                      value={designSettings.secondary_color}
                      onChange={(e) => setDesignSettings(prev => ({ ...prev, secondary_color: e.target.value }))}
                      className="w-12 h-10 rounded border border-gray-300"
                    />
                    <Input 
                      value={designSettings.secondary_color}
                      onChange={(e) => setDesignSettings(prev => ({ ...prev, secondary_color: e.target.value }))}
                      placeholder="#f3f4f6" 
                      className="flex-1" 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Layout Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Layout className="h-5 w-5" />
                <span>Layout & Display</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="font-family">Font Family</Label>
                  <select 
                    id="font-family" 
                    value={designSettings.font_family}
                    onChange={(e) => setDesignSettings(prev => ({ ...prev, font_family: e.target.value }))}
                    className="w-full mt-2 p-2 border border-gray-300 rounded-md"
                  >
                    <option value="inter">Inter (Default)</option>
                    <option value="roboto">Roboto</option>
                    <option value="opensans">Open Sans</option>
                    <option value="poppins">Poppins</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="font-size">Font Size</Label>
                  <select 
                    id="font-size" 
                    value={designSettings.font_size}
                    onChange={(e) => setDesignSettings(prev => ({ ...prev, font_size: e.target.value }))}
                    className="w-full mt-2 p-2 border border-gray-300 rounded-md"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="show-descriptions" 
                  checked={designSettings.show_descriptions}
                  onChange={(e) => setDesignSettings(prev => ({ ...prev, show_descriptions: e.target.checked }))}
                  className="rounded" 
                />
                <Label htmlFor="show-descriptions">Show item descriptions</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="show-prices" 
                  checked={designSettings.show_prices}
                  onChange={(e) => setDesignSettings(prev => ({ ...prev, show_prices: e.target.checked }))}
                  className="rounded" 
                />
                <Label htmlFor="show-prices">Show prices</Label>
              </div>
            </CardContent>
          </Card>

          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Image className="h-5 w-5" />
                <span>Branding</span>
            </CardTitle>
          </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="venue-name">Venue Name</Label>
                <Input 
                  id="venue-name" 
                  value={designSettings.venue_name}
                  onChange={(e) => setDesignSettings(prev => ({ ...prev, venue_name: e.target.value }))}
                  placeholder="Your Restaurant Name" 
                  className="mt-2" 
                />
              </div>
              <div>
                <Label htmlFor="logo-upload">Logo Upload</Label>
                <div className="mt-2">
                  {designSettings.logo_url && (
                    <div className="mb-4">
                      <img 
                        src={designSettings.logo_url} 
                        alt="Current logo" 
                        className="h-16 w-auto object-contain border border-gray-200 rounded"
                      />
                    </div>
                  )}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={isUploadingLogo}
                    />
                    <label htmlFor="logo-upload" className="cursor-pointer">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {isUploadingLogo ? 'Uploading...' : 'Click to upload or drag and drop'}
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG up to 2MB</p>
                    </label>
                  </div>
                </div>
              </div>
          </CardContent>
        </Card>

          <div className="flex justify-end">
            <Button 
              onClick={saveDesignSettings}
              disabled={isSavingDesign}
              className="flex items-center space-x-2 w-full sm:w-auto"
            >
              <Save className="h-4 w-4" />
              <span>{isSavingDesign ? 'Saving...' : 'Save Design'}</span>
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="space-y-6">
          {/* Preview Controls */}
        <Card>
          <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
              <Eye className="h-5 w-5" />
              <span>Menu Preview</span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    <Share className="h-4 w-4 mr-2" />
                    Share Link
                  </Button>
                </div>
            </CardTitle>
          </CardHeader>
          </Card>

          {/* Menu Preview */}
          <Card>
            <CardContent className="p-0">
              <div 
                className="bg-white min-h-[600px] p-8"
                style={{
                  fontFamily: designSettings.font_family === 'inter' ? 'Inter, sans-serif' :
                             designSettings.font_family === 'roboto' ? 'Roboto, sans-serif' :
                             designSettings.font_family === 'opensans' ? 'Open Sans, sans-serif' :
                             designSettings.font_family === 'poppins' ? 'Poppins, sans-serif' : 'Inter, sans-serif',
                  fontSize: designSettings.font_size === 'small' ? '14px' :
                           designSettings.font_size === 'large' ? '18px' : '16px'
                }}
              >
                {/* Menu Header */}
                <div className="text-center mb-8 pb-6 border-b border-gray-200">
                  {designSettings.logo_url && (
                    <div className="mb-4">
                      <img 
                        src={designSettings.logo_url} 
                        alt="Restaurant logo" 
                        className="h-20 w-auto object-contain mx-auto"
                      />
                    </div>
                  )}
                  <h1 
                    className="text-3xl font-bold mb-2"
                    style={{ color: designSettings.primary_color }}
                  >
                    {designSettings.venue_name || 'Your Restaurant'}
                  </h1>
                  <p className="text-gray-600">Delicious food, great service</p>
                </div>

                {/* Menu Categories */}
                {menuItems.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No menu items to preview</h3>
                    <p className="text-gray-500 mb-4">Add some menu items in the Manage tab to see your menu preview.</p>
                    <Button onClick={() => setActiveTab('manage')} className="flex items-center space-x-2">
                      <Plus className="h-4 w-4" />
                      <span>Add Menu Items</span>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {getCategories().map(category => (
                      <div key={category} className="space-y-4">
                        <h2 
                          className="text-2xl font-bold border-b-2 pb-2"
                          style={{ 
                            color: designSettings.primary_color,
                            borderBottomColor: designSettings.primary_color
                          }}
                        >
                          {category}
                        </h2>
                        <div className="grid gap-4">
                          {getItemsByCategory(category).map(item => (
                            <div key={item.id} className="flex justify-between items-start py-2">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                  {!item.is_available && (
                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Unavailable</span>
                                  )}
                                </div>
                                {item.description && designSettings.show_descriptions && (
                                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                                )}
                              </div>
                              {designSettings.show_prices && (
                                <div className="text-right">
                                  <span 
                                    className="font-bold text-lg"
                                    style={{ color: designSettings.primary_color }}
                                  >
                                    {formatPriceWithCurrency(item.price, '£')}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Menu Footer */}
                {menuItems.length > 0 && (
                  <div className="text-center mt-12 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-500">Thank you for choosing us!</p>
                  </div>
                )}
              </div>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
}