"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { Clock, Users, TrendingUp, ShoppingBag, BarChart, QrCode, Settings, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
import { todayWindowForTZ } from "@/lib/time";

interface DashboardCounts {
  live_count: number;
  earlier_today_count: number;
  history_count: number;
  today_orders_count: number;
  active_tables_count: number;
}

interface DashboardStats {
  revenue: number;
  menuItems: number;
  unpaid: number;
}

export default function VenueDashboardClient({ 
  venueId, 
  userId, 
  venue: initialVenue, 
  userName,
  venueTz,
  initialCounts,
  initialStats
}: { 
  venueId: string; 
  userId: string; 
  venue?: any; 
  userName: string;
  venueTz: string;
  initialCounts?: DashboardCounts;
  initialStats?: DashboardStats;
}) {
  const [venue, setVenue] = useState<any>(initialVenue);
  const [loading, setLoading] = useState(!initialVenue); // Start with loading false if we have initial venue data
  const [counts, setCounts] = useState<DashboardCounts>(initialCounts || {
    live_count: 0,
    earlier_today_count: 0,
    history_count: 0,
    today_orders_count: 0,
    active_tables_count: 0
  });
  const [stats, setStats] = useState<DashboardStats>(initialStats || { revenue: 0, menuItems: 0, unpaid: 0 });
  const [todayWindow, setTodayWindow] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const loadVenueAndStats = async () => {
      try {
        console.log('[DASHBOARD] Loading venue and stats for venueId:', venueId);
        
        // Check if we already have venue data from SSR
        if (venue && !loading) {
          console.log('[DASHBOARD] Venue already loaded from SSR, setting up time window and stats');
          const window = todayWindowForTZ(venueTz);
          setTodayWindow(window);
          await loadStats(venue.venue_id, window);
          return;
        }
        
        // Load venue data and stats (userId already verified by SSR)
        const { data: venueData, error } = await createClient()
          .from("venues")
          .select("*")
          .eq("venue_id", venueId)
          .single();
        
        console.log('[DASHBOARD] Venue query result:', { hasData: !!venueData, error: error?.message });
        
        if (!error && venueData) {
          setVenue(venueData);
          const window = todayWindowForTZ(venueTz);
          setTodayWindow(window);
          await loadStats(venueData.venue_id, window);
        } else {
          console.error('[DASHBOARD] Failed to load venue:', error);
          // Set loading to false even on error to prevent infinite loading
          setLoading(false);
        }
      } catch (error) {
        console.error('[DASHBOARD] Unexpected error loading venue:', error);
        // Set loading to false even on error to prevent infinite loading
        setLoading(false);
      }
    };

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('[DASHBOARD] Loading timeout reached, forcing loading to false');
      setLoading(false);
    }, 10000); // 10 second timeout

    loadVenueAndStats();

    return () => clearTimeout(timeoutId);
  }, [venueId]); // Remove venue from dependencies to prevent infinite loop

  // Handle initial venue data from SSR
  useEffect(() => {
    if (initialVenue && !venue) {
      console.log('[DASHBOARD] Setting initial venue from SSR');
      setVenue(initialVenue);
      setLoading(false);
    }
  }, [initialVenue, venue]);

  // Set up time window when venue data is available
  useEffect(() => {
    if (venue && !todayWindow) {
      console.log('[DASHBOARD] Setting up time window for venue');
      const window = todayWindowForTZ(venueTz);
      setTodayWindow(window);
      loadStats(venue.venue_id, window);
    }
  }, [venue, todayWindow, venueTz]);

  // Set up real-time subscription for orders to update counts
  useEffect(() => {
    if (!venue || !todayWindow) {
      console.log('[DASHBOARD] Skipping subscription setup - venue or todayWindow not ready');
      return;
    }

    console.log('[DASHBOARD] Setting up real-time subscription with window:', todayWindow);
    
    const channel = createClient()
      .channel('dashboard-orders')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        }, 
        async (payload) => {
          console.log('Dashboard order change:', payload);
          
          // Get the order date from the payload with proper type checking
          const orderCreatedAt = (payload.new as any)?.created_at || (payload.old as any)?.created_at;
          if (!orderCreatedAt) {
            console.log('No created_at found in payload, ignoring');
            return;
          }
          
          // Only refresh counts if the order is within today's window
          const isInTodayWindow = orderCreatedAt >= todayWindow.startUtcISO && orderCreatedAt < todayWindow.endUtcISO;
          
          console.log('[DASHBOARD] Order change analysis:', {
            orderCreatedAt,
            windowStart: todayWindow.startUtcISO,
            windowEnd: todayWindow.endUtcISO,
            isInTodayWindow,
            orderId: (payload.new as any)?.id || (payload.old as any)?.id
          });
          
          if (isInTodayWindow) {
            console.log('Refreshing counts for today\'s order change');
            await refreshCounts();
            await loadStats(venue.venue_id, todayWindow);
          } else {
            console.log('Ignoring historical order change, not refreshing counts');
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[DASHBOARD] Cleaning up real-time subscription');
      createClient().removeChannel(channel);
    };
  }, [venueId, venue?.venue_id, todayWindow?.startUtcISO, venueTz]); // Use specific properties instead of objects to prevent unnecessary re-runs

  // Function to refresh counts using the new RPC
  const refreshCounts = async () => {
    try {
      const supabase = createClient();
      const { data: newCounts, error } = await supabase
        .rpc('dashboard_counts', { 
          p_venue_id: venueId, 
          p_tz: venueTz, 
          p_live_window_mins: 30 
        })
        .single();
      
      if (error) {
        console.error('[DASHBOARD] Error refreshing counts:', error);
        return;
      }
      
      console.log('[DASHBOARD] Counts refreshed:', newCounts);
      setCounts(newCounts);
    } catch (error) {
      console.error('[DASHBOARD] Error refreshing counts:', error);
    }
  };

  const loadStats = async (vId: string, window: any) => {
    try {
      console.log('[DASHBOARD] Loading stats for today:', window.startUtcISO, 'to', window.endUtcISO);

      const { data: orders } = await createClient()
        .from("orders")
        .select("total_amount, table_number, status, payment_status, created_at, items")
        .eq("venue_id", vId)
        .gte("created_at", window.startUtcISO)
        .lt("created_at", window.endUtcISO);

      console.log('[DASHBOARD] Found orders for today:', orders?.length || 0);

      const { data: menuItems } = await createClient()
        .from("menu_items")
        .select("id")
        .eq("venue_id", vId)
        .eq("available", true);

      // Calculate revenue from today's paid orders only (robust amount fallback)
      const todayRevenue = (orders ?? []).reduce((sum: number, order: any) => {
        let amount = Number(order.total_amount) || parseFloat(order.total_amount as any) || 0;
        if (!Number.isFinite(amount) || amount <= 0) {
          if (Array.isArray(order.items)) {
            amount = order.items.reduce((s: number, it: any) => {
              const unit = Number(it.unit_price ?? it.price ?? 0);
              const qty = Number(it.quantity ?? it.qty ?? 0);
              return s + (Number.isFinite(unit) && Number.isFinite(qty) ? unit * qty : 0);
            }, 0);
          }
        }
        // All orders are now paid since they only appear after payment
        return sum + amount;
      }, 0);

      setStats({
        revenue: todayRevenue,
        menuItems: menuItems?.length || 0,
        unpaid: 0, // All orders are now paid since they only appear after payment
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading venue dashboard...</p>
          <p className="mt-1 text-xs text-gray-500">Venue ID: {venueId}</p>
          {venue && <p className="mt-1 text-xs text-gray-500">Venue: {venue.name}</p>}
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load venue</h2>
          <p className="text-gray-600 mb-4">The venue data could not be loaded. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Simple breadcrumb for main dashboard */}
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Welcome back, {userName}!
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">Here's what's happening at {venue?.name || "your venue"} today</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
           <Link href={`/dashboard/${venueId}/live-orders?since=today`}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Today's Orders</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{counts.today_orders_count}</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/analytics`}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Revenue</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">£{stats.revenue.toFixed(2)}</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                </div>
                {/* Remove unpaid count since all orders are now paid */}
              </CardContent>
            </Card>
          </Link>

           <Link href={`/generate-qr?venue=${venueId}`}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Active Tables</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{counts.active_tables_count}</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/menu`}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Menu Items</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{stats.menuItems}</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Link href={`/dashboard/${venueId}/live-orders`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Live Orders</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">Monitor and manage incoming orders in real-time</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/menu`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Menu Management</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">Update your menu items and manage categories</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/generate-qr?venue=${venueId}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <QrCode className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">QR Codes</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">Generate and manage QR codes for your tables</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/analytics`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Analytics</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">View detailed reports and business insights</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/feedback`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Feedback</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">See customer reviews and ratings</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/staff`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-slate-700" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Staff Management</h3>
                <p className="text-muted-foreground text-xs sm:text-sm">Add staff and manage roles</p>
              </CardContent>
            </Card>
          </Link>


        </div>

        {/* Getting Started Section */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-foreground">Getting Started</h3>
              <p className="text-muted-foreground">Complete these steps to set up your venue</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Plus className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Add Menu Items</h4>
                    <p className="text-sm text-muted-foreground">Upload your menu or add items manually</p>
                  </div>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/dashboard/${venueId}/menu?openAdd=true`}>Get Started</Link>
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <QrCode className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Generate QR Codes</h4>
                    <p className="text-sm text-muted-foreground">Create QR codes for your tables</p>
                  </div>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/generate-qr?venue=${venueId}`}>Generate</Link>
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Settings className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Configure Settings</h4>
                    <p className="text-sm text-muted-foreground">Customize your venue settings</p>
                  </div>
                </div>
                <Button variant="outline" asChild>
                  <Link href={`/dashboard/${venueId}/settings`}>Configure</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


