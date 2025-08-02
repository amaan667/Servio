"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MenuManagement } from "@/components/menu-management";
import { NavBar } from "@/components/NavBar";
import { useRouter } from "next/navigation";

export default function MenuPage({ params }: { params: { venueId: string } }) {
  const [session, setSession] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalItems: 0,
    categories: 0,
    unavailableItems: 0
  });
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        const { data: venueData, error } = await supabase
          .from("venues")
          .select("*")
          .eq("owner_id", session.user.id)
          .single();
        
        if (!error && venueData) {
          setVenue(venueData);
          await loadStats(venueData.venue_id);
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

  const loadStats = async (venueId: string) => {
    try {
      const { data: menuItems, error: menuError } = await supabase
        .from("menu_items")
        .select("id, category, available")
        .eq("venue_id", venueId);

      if (!menuError && menuItems) {
        const categories = new Set(menuItems.map(item => item.category)).size;
        const unavailableItems = menuItems.filter(item => !item.available).length;

        setStats({
          totalItems: menuItems.length,
          categories,
          unavailableItems
        });
      }
    } catch (error) {
      console.error("Error loading menu stats:", error);
    }
  };

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
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Menu Management</h2>
          <p className="text-gray-600">Update your menu items and manage categories</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Categories</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.categories}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Unavailable Items</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.unavailableItems}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Menu Management */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Menu Items</h3>
          </CardHeader>
          <CardContent>
            <MenuManagement venueId={params.venueId} session={session} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
