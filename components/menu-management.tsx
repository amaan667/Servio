"use client";

import type React from "react";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlusCircle,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Upload,
  Link,
  FileText,
} from "lucide-react";
import {
  supabase,
  hasSupabaseConfig,
  type MenuItem,
  type AuthSession,
} from "@/lib/supabase";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface MenuManagementProps {
  venueId: string;
  session: AuthSession;
}

export function MenuManagement({ venueId, session }: MenuManagementProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  // Remove menuUrl state
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: 0,
    category: "",
    available: true,
  });
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditItems, setBatchEditItems] = useState<MenuItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [batchAction, setBatchAction] = useState<null | "edit" | "unavailable" | "category" | "price" | "delete">(null);
  const [batchEditValue, setBatchEditValue] = useState<any>(null);
  const [editItemDraft, setEditItemDraft] = useState<Partial<MenuItem> | null>(null);

  const venueUuid = session.venue.id;

  const fetchMenu = useCallback(async () => {
    logger.info("Fetching menu items", { venueUuid });

    setLoading(true);
    setError(null);

    if (!hasSupabaseConfig || !supabase) {
      logger.error("Supabase not configured");
      setError("Service is not configured.");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", venueUuid)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        logger.error("Failed to fetch menu from Supabase", {
          error: error.message,
          code: error.code,
          venueUuid,
        });
        setError("Failed to load menu items.");
      } else {
        logger.info("Menu fetched successfully", {
          itemCount: data?.length || 0,
          categories: [...new Set(data?.map((item) => item.category) || [])],
        });
        setMenuItems(data || []);
      }
    } catch (error: any) {
      logger.error("Unexpected error fetching menu", { error });
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [venueUuid]);

  useEffect(() => {
    fetchMenu();

    if (!supabase) return;

    logger.debug("Setting up real-time subscription");
    const channel = supabase
      .channel(`menu-management-${venueUuid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `venue_id=eq.${venueUuid}`,
        },
        (payload) => {
          logger.info("Real-time change detected, refetching menu", {
            payload,
          });
          fetchMenu();
        },
      )
      .subscribe((status) => {
        logger.debug("Real-time subscription status", { status });
      });

    return () => {
      logger.debug("Cleaning up real-time subscription");
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchMenu, venueUuid]);

  // Enhanced file upload handler for both input and drag-and-drop
  const handleFile = (file: File) => {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("menu", file);
    formData.append("venueId", venueUuid);

    fetch("/api/upload-menu", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.error) {
          setError(result.error || "Failed to process menu file.");
          setUploading(false);
          return;
        }
        // Success - the upload-menu API handles both upload and database insertion
        setError(null);
        setUploading(false);
        // Refresh the menu to show new items
        fetchMenu();
      })
      .catch((error) => {
        setError("Failed to process menu file.");
        setUploading(false);
      });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  };

  // Drag-and-drop handlers
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleAddItem = async () => {
    logger.info("Starting add item process", {
      name: newItem.name.trim(),
      category: newItem.category.trim(),
      price: newItem.price,
      venueUuid,
      userId: session.user.id,
    });
    if (
      !newItem.name.trim() ||
      !newItem.category.trim() ||
      newItem.price <= 0
    ) {
      setError("Please fill out all required fields with valid values.");
      return;
    }
    setSaving("add");
    setError(null);
    try {
      // Use API route to insert
      const res = await fetch("/api/extract-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              venue_id: venueUuid,
              name: newItem.name.trim(),
              description: newItem.description.trim(),
              price: newItem.price,
              category: newItem.category.trim(),
              available: newItem.available,
            },
          ],
          venue_id: venueUuid,
        }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        logger.error("Failed to add item to Supabase", {
          error: result.error,
          venueUuid,
          userId: session.user.id,
        });
        setError(result.error || "Failed to add item.");
      } else {
        logger.info("Item added successfully");
        setNewItem({
          name: "",
          description: "",
          price: 0,
          category: "",
          available: true,
        });
      }
    } catch (error: any) {
      logger.error("Unexpected error adding item", { error });
      setError("An unexpected error occurred.");
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateItem = async (
    itemId: string,
    updates: Partial<MenuItem>,
  ) => {
    logger.info("Updating item", { itemId, updates });

    if (!supabase) return;

    setSaving(itemId);

    try {
      const { error } = await supabase
        .from("menu_items")
        .update(updates)
        .eq("id", itemId);

      if (error) {
        logger.error("Failed to update item", {
          itemId,
          error: error.message,
          code: error.code,
        });
        setError(`Failed to update item: ${error.message}`);
      } else {
        logger.info("Item updated successfully", { itemId });
      }
    } catch (error: any) {
      logger.error("Unexpected error updating item", { error });
      setError("An unexpected error occurred.");
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    logger.info("Deleting item", { itemId });

    if (!supabase) return;

    setSaving(itemId);

    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", itemId);

      if (error) {
        logger.error("Failed to delete item", {
          itemId,
          error: error.message,
          code: error.code,
        });
        setError(`Failed to delete item: ${error.message}`);
      } else {
        logger.info("Item deleted successfully", { itemId });
      }
    } catch (error: any) {
      logger.error("Unexpected error deleting item", { error });
      setError("An unexpected error occurred.");
    } finally {
      setSaving(null);
    }
  };

  // Clear all menu items
  const handleClearMenu = async () => {
    if (!window.confirm("Are you sure you want to clear the entire menu? This cannot be undone.")) return;
    setSaving("clear");
    setError(null);
    try {
      if (!supabase) {
        setError("Supabase is not configured.");
        setSaving(null);
        return;
      }
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("venue_id", venueUuid);
      if (error) {
        setError("Failed to clear menu: " + error.message);
      } else {
        setMenuItems([]);
      }
    } catch (error: any) {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(null);
    }
  };
  // Batch edit logic
  const openBatchEdit = () => {
    setBatchEditItems(menuItems.map(item => ({ ...item })));
    setBatchEditOpen(true);
  };
  const handleBatchEditChange = (id: string, updates: Partial<MenuItem>) => {
    setBatchEditItems(items => items.map(item => item.id === id ? { ...item, ...updates } : item));
  };
  const saveBatchEdit = async () => {
    setSaving("batch");
    setError(null);
    try {
      if (!supabase) {
        setError("Supabase is not configured.");
        setSaving(null);
        return;
      }
      for (const item of batchEditItems) {
        await supabase.from("menu_items").update({ category: item.category }).eq("id", item.id);
      }
      setBatchEditOpen(false);
      fetchMenu();
    } catch (error: any) {
      setError("Failed to save batch edits.");
    } finally {
      setSaving(null);
    }
  };

  // Select all logic
  const allVisibleIds = menuItems.map(item => item.id);
  const allSelected = selectedItems.length === allVisibleIds.length && allVisibleIds.length > 0;
  const toggleSelectAll = () => {
    setSelectedItems(allSelected ? [] : allVisibleIds);
  };
  const toggleSelectItem = (id: string) => {
    setSelectedItems(selectedItems.includes(id)
      ? selectedItems.filter(i => i !== id)
      : [...selectedItems, id]);
  };
  // Batch actions
  const handleBatchAction = (action: typeof batchAction) => {
    setBatchAction(action);
    setBatchEditValue(null);
  };
  const confirmBatchEdit = async () => {
    if (!supabase) return;
    setSaving("batch");
    setError(null);
    try {
      if (batchAction === "unavailable") {
        await supabase.from("menu_items").update({ available: false }).in("id", selectedItems);
      } else if (batchAction === "category") {
        await supabase.from("menu_items").update({ category: batchEditValue }).in("id", selectedItems);
      } else if (batchAction === "price") {
        await supabase.from("menu_items").update({ price: Number(batchEditValue) }).in("id", selectedItems);
      } else if (batchAction === "edit") {
        // For demo: just mark available true
        await supabase.from("menu_items").update({ available: true }).in("id", selectedItems);
      } else if (batchAction === "delete") {
        await supabase.from("menu_items").delete().in("id", selectedItems);
      }
      setBatchAction(null);
      setSelectedItems([]);
      fetchMenu();
    } catch (error: any) {
      setError("Failed to perform batch action.");
    } finally {
      setSaving(null);
    }
  };

  const categories = [
    ...new Set(menuItems.map((item) => item.category)),
  ].sort();

  return (
    <div className="space-y-6">
      {!hasSupabaseConfig && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Service is not configured. Menu management is disabled.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          <TabsTrigger value="upload">Upload Menu</TabsTrigger>
          <TabsTrigger value="url">Extract from URL</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle>Add Menu Items Manually</CardTitle>
              <CardDescription>
                Add individual menu items to your restaurant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                    placeholder="e.g., Cappuccino"
                    disabled={saving === "add"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Input
                    id="category"
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem({ ...newItem, category: e.target.value })
                    }
                    placeholder="e.g., Coffee"
                    disabled={saving === "add"}
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map((category) => (
                      <option key={category} value={category} />
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
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        price: Number.parseFloat(e.target.value) || 0,
                      })
                    }
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
                      onCheckedChange={(checked) =>
                        setNewItem({ ...newItem, available: checked })
                      }
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
                  onChange={(e) =>
                    setNewItem({ ...newItem, description: e.target.value })
                  }
                  placeholder="Optional description of the item"
                  disabled={saving === "add"}
                />
              </div>

              <Button
                onClick={handleAddItem}
                disabled={saving === "add" || loading}
                className="w-full"
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
        </TabsContent>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Menu File</CardTitle>
              <CardDescription>
                Upload a photo or PDF of your menu and we'll extract the items
                automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                ref={dropRef}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive ? "border-servio-purple bg-purple-50" : "border-gray-300"}`}
                style={{ cursor: uploading ? "not-allowed" : "pointer" }}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <div className="space-y-2">
                  <Label htmlFor="menu-file" className="cursor-pointer">
                    <span className="text-sm font-medium text-servio-purple hover:text-servio-purple-dark">
                      Click to upload
                    </span>
                    <span className="text-sm text-gray-500">
                      {" "}
                      or drag and drop
                    </span>
                  </Label>
                  <Input
                    id="menu-file"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-500">
                    PNG, JPG, PDF up to 10MB
                  </p>
                </div>
                {dragActive && (
                  <div className="absolute inset-0 bg-servio-purple/10 border-4 border-servio-purple rounded-lg pointer-events-none flex items-center justify-center">
                    <span className="text-servio-purple font-semibold text-lg">
                      Drop your file here
                    </span>
                  </div>
                )}
              </div>
              {uploading && (
                <div className="text-center">
                  <RefreshCw className="h-6 w-6 mx-auto animate-spin text-servio-purple mb-2" />
                  <p className="text-sm text-gray-600">
                    Processing your menu...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="url">
          <Card>
            <CardHeader>
              <CardTitle>Extract from URL</CardTitle>
              <CardDescription>
                Provide a URL to your online menu and we'll extract the items
                automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="menu-url">Menu URL</Label>
                <Input
                  id="menu-url"
                  type="url"
                  placeholder="https://yourrestaurant.com/menu"
                  disabled={extracting}
                />
              </div>
              <Button
                onClick={() => {}}
                disabled={extracting || !newItem.name.trim()}
                className="w-full"
              >
                {extracting ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link className="mr-2 h-4 w-4" />
                )}
                Extract Menu Items
              </Button>
              {extracting && (
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Extracting menu items from URL...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Existing Menu Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Menu ({menuItems.length} items)</span>
            <div className="flex flex-col items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearMenu}
                disabled={saving === "clear"}
              >
                <Trash2 className={`mr-2 h-4 w-4 ${saving === "clear" ? "animate-spin" : ""}`} />
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMenu}
                disabled={loading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              <span className="text-xs">Select All</span>
            </div>
            Edit or remove existing menu items. Changes are saved automatically
            and will be live for customers instantly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 mx-auto text-gray-400 animate-spin mb-4" />
              <p className="text-gray-600">Loading menu items...</p>
            </div>
          ) : menuItems.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">
                No menu items found. Add some items above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {categories.map((category) => (
                <div key={category} className="space-y-2">
                  <h3 className="font-semibold text-lg text-servio-purple border-b pb-1">
                    {category}
                  </h3>
                  {menuItems
                    .filter((item) => item.category === category)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="border p-4 rounded-lg flex items-center justify-between hover:bg-gray-50 group"
                      >
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                          className="mr-4"
                        />
                        <div className="flex-1">
                          {editingItemId === item.id ? (
                            <div className="flex flex-col md:flex-row md:items-center gap-2">
                              <Input
                                value={editItemDraft?.name ?? item.name}
                                onChange={e => setEditItemDraft(draft => ({ ...draft, name: e.target.value }))}
                                className="w-40"
                                placeholder="Name"
                              />
                              <Input
                                value={editItemDraft?.category ?? item.category}
                                onChange={e => setEditItemDraft(draft => ({ ...draft, category: e.target.value }))}
                                className="w-32"
                                placeholder="Category"
                              />
                              <Input
                                type="number"
                                step="0.01"
                                value={editItemDraft?.price ?? item.price}
                                onChange={e => setEditItemDraft(draft => ({ ...draft, price: Number(e.target.value) }))}
                                className="w-24"
                                placeholder="Price"
                              />
                              <Input
                                value={editItemDraft?.description ?? item.description}
                                onChange={e => setEditItemDraft(draft => ({ ...draft, description: e.target.value }))}
                                className="w-48"
                                placeholder="Description"
                              />
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={editItemDraft?.available ?? item.available}
                                  onCheckedChange={checked => setEditItemDraft(draft => ({ ...draft, available: checked }))}
                                />
                                <Label className="text-sm">{(editItemDraft?.available ?? item.available) ? "Available" : "Unavailable"}</Label>
                              </div>
                              <Button
                                size="sm"
                                onClick={async () => {
                                  if (!editItemDraft) return;
                                  setSaving(item.id);
                                  await handleUpdateItem(item.id, editItemDraft);
                                  setEditingItemId(null);
                                  setEditItemDraft(null);
                                }}
                                disabled={saving === item.id}
                                className="ml-2"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditingItemId(null); setEditItemDraft(null); }}
                                className="ml-1"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-3">
                              <h4 className="font-semibold text-lg">{item.name}</h4>
                              <span className="text-lg font-bold text-green-600">£{item.price.toFixed(2)}</span>
                              <span className="text-xs text-gray-500">{item.category}</span>
                              {item.description && <span className="text-xs text-gray-500">{item.description}</span>}
                              <span className="text-xs text-gray-500">{item.available ? "Available" : "Unavailable"}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={saving === item.id}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            {saving === item.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditItemDraft({
                                name: item.name,
                                price: item.price,
                                category: item.category,
                                description: item.description,
                                available: item.available,
                              });
                            }}
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Sticky batch action bar */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t z-50 shadow-lg flex items-center justify-center gap-4 py-3">
          <span className="font-medium">{selectedItems.length} selected</span>
          <Button onClick={() => handleBatchAction("unavailable")}>Mark Unavailable</Button>
          <Button onClick={() => handleBatchAction("category")}>Change Category</Button>
          <Button onClick={() => handleBatchAction("price")}>Bulk Price Edit</Button>
          <Button variant="destructive" onClick={() => handleBatchAction("delete")}>Delete</Button>
        </div>
      )}
      {/* Batch edit modal */}
      {batchAction && (
        <Dialog open={!!batchAction} onOpenChange={v => !v && setBatchAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Batch {batchAction === "edit" ? "Edit" : batchAction === "unavailable" ? "Mark Unavailable" : batchAction === "category" ? "Change Category" : batchAction === "price" ? "Bulk Price Edit" : "Delete"}</DialogTitle>
            </DialogHeader>
            {batchAction === "category" && (
              <Input placeholder="New category" value={batchEditValue || ""} onChange={e => setBatchEditValue(e.target.value)} />
            )}
            {batchAction === "price" && (
              <Input placeholder="New price" type="number" value={batchEditValue || ""} onChange={e => setBatchEditValue(e.target.value)} />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setBatchAction(null)}>Cancel</Button>
              <Button onClick={confirmBatchEdit} disabled={saving === "batch"}>{saving === "batch" ? "Saving..." : "Confirm"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {batchEditOpen && (
        <Dialog open={batchEditOpen} onOpenChange={setBatchEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Batch Edit Categories</DialogTitle>
              <DialogDescription>Edit categories for multiple menu items at once.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {batchEditItems.map(item => (
                <div key={item.id} className="flex items-center gap-4">
                  <span className="w-40 truncate">{item.name}</span>
                  <Input
                    value={item.category}
                    onChange={e => handleBatchEditChange(item.id, { category: e.target.value })}
                    className="w-48"
                  />
                </div>
              ))}
            </div>
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setBatchEditOpen(false)}>Cancel</Button>
              <Button onClick={saveBatchEdit} disabled={saving === "batch"}>{saving === "batch" ? "Saving..." : "Save Changes"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
