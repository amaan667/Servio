"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MenuManagement } from "@/components/menu-management";
import { MenuUploadCard } from "@/components/MenuUploadCard";
import NavBar from '@/components/NavBar';
import { venuePath } from '@/lib/path';

export default function MenuManagementPage({ params }: { params: { venueId: string } }) {
  const [session, setSession] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const router = useRouter();

  const venueId = venue?.venue_id || params.venueId;

  const loadMenuItems = async () => {
    if (!supabase || !venueId) return;
    
    try {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("venue_id", venueId)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.error("Failed to load menu items:", error);
      } else {
        setMenuItems(data || []);
      }
    } catch (error) {
      console.error("Error loading menu items:", error);
    }
  };

  const handleClearMenu = async () => {
    if (!window.confirm("Are you sure you want to clear the entire menu? This cannot be undone.")) return;
    if (!supabase || !venueId) return;
    
    setSaving("clear");
    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("venue_id", venueId);
      
      if (error) {
        console.error("Failed to clear menu:", error);
      } else {
        setMenuItems([]);
      }
    } catch (error) {
      console.error("Error clearing menu:", error);
    } finally {
      setSaving(null);
    }
  };

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        // Fetch venue for the user
        const { data: venueData, error } = await supabase
          .from("venues")
          .select("*")
          .eq("owner_id", session.user.id)
          .single();
        
        if (!error && venueData) {
          setVenue(venueData);
        }
      }
      
      setLoading(false);
    };
    
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (venueId) {
      loadMenuItems();
    }
  }, [venueId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.replace("/sign-in");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
  <NavBar venueId={venueId} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/dashboard/${params.venueId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Menu Management
          </h1>
          <p className="text-gray-600">
            Manage your menu items, categories, and pricing
          </p>
        </div>

        {/* Upload Menu Section */}
        <div className="mb-8">
          <MenuUploadCard venueId={venueId} onSuccess={loadMenuItems} />
        </div>

        {/* Action Buttons - Positioned where the black circle indicates */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={loadMenuItems}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {menuItems.length > 0 && (
              <Button
                variant="destructive"
                onClick={handleClearMenu}
                disabled={saving === "clear"}
              >
                <Trash2 className={`mr-2 h-4 w-4 ${saving === "clear" ? "animate-spin" : ""}`} />
                Clear Menu
              </Button>
            )}
          </div>
          <Button
            onClick={() => {
              // This will open the add item modal in the MenuManagement component
              const addButton = document.querySelector('[data-add-item-button]') as HTMLButtonElement;
              if (addButton) {
                addButton.click();
              }
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>

        {/* Menu Management Component */}
        <MenuManagement venueId={venueId} session={{ user: session?.user, venue }} />
      </div>
    </div>
  );
}