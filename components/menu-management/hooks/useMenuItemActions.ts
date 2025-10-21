import { useState } from 'react';
import { supabaseBrowser as createClient } from '@/lib/supabase';
import { MenuItem, NewItem } from '../types';

export function useMenuItemActions(venueId: string, onRefresh: () => void) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const venueUuid = venueId.startsWith('venue-') ? venueId : `venue-${venueId}`;

  const handleAddItem = async (newItem: NewItem) => {
    if (!newItem.name.trim() || !newItem.category.trim() || newItem.price <= 0) {
      setError("Please fill out all required fields with valid values.");
      return;
    }
    
    setSaving("add");
    setError(null);
    
    try {
      const res = await fetch("/api/extract-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            venue_id: venueUuid,
            name: newItem.name.trim(),
            description: newItem.description.trim(),
            price: newItem.price,
            category: newItem.category.trim(),
            available: newItem.available,
          }],
          venue_id: venueUuid,
        }),
      });
      
      const result = await res.json();
      if (!res.ok || result.error) {

        setError(result.error || "Failed to add item.");
      } else {

      }
    } catch (error: unknown) {

      setError("An unexpected error occurred.");
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateItem = async (itemId: string, updates: Partial<MenuItem>) => {

    const supabase = createClient();
    if (!supabase) return;

    setSaving(itemId);

    try {
      const { error } = await supabase
        .from("menu_items")
        .update(updates)
        .eq("id", itemId);

      if (error) {

        setError(`Failed to update item: ${error.message}`);
      } else {

      }
    } catch (error: unknown) {

      setError("An unexpected error occurred.");
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm("Are you sure you want to delete this menu item?")) return;

    const supabase = createClient();
    if (!supabase) return;

    setSaving(itemId);

    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", itemId);

      if (error) {

        setError(`Failed to delete item: ${error.message}`);
      } else {

      }
    } catch (error: unknown) {

      setError("An unexpected error occurred.");
    } finally {
      setSaving(null);
    }
  };

  const handleClearMenu = async () => {
    if (!window.confirm("Are you sure you want to clear the entire menu? This cannot be undone.")) return;
    
    setSaving("clear");
    setError(null);
    
    try {
      const supabase = createClient();
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
      }
    } catch (error: unknown) {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(null);
    }
  };

  return {
    saving,
    error,
    handleAddItem,
    handleUpdateItem,
    handleDeleteItem,
    handleClearMenu,
  };
}

