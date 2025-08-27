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

const supabase = createClient();

export default function VenueDashboardClient({ venueId, userId, activeTables: activeTablesFromSSR = 0, venue: initialVenue }: { venueId: string; userId: string; activeTables?: number; venue?: any }) {
  const [venue, setVenue] = useState<any>(initialVenue);
  const [loading, setLoading] = useState(!initialVenue); // Start with loading false if we have initial venue data
  const [stats, setStats] = useState({ todayOrders: 0, revenue: 0, activeTables: activeTablesFromSSR, menuItems: 0, unpaid: 0 });
  const [todayWindow, setTodayWindow] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const loadVenueAndStats = async () => {
      try {
        console.log('[DASHBOARD] Loading venue and stats for venueId:', venueId);
        
        // Check if we already have venue data from SSR
        if (venue && !loading) {
          console.log('[DASHBOARD] Venue already loaded from SSR, setting up time window and stats');
          const window = todayWindowForTZ(venue.timezone || 'Europe/London');
          setTodayWindow(window);
          await loadStats(venue.venue_id, window);
          return;
        }
        
        // Load venue data and stats (userId already verified by SSR)
        const { data: venueData, error } = await supabase
          .from("venues")
          .select("*")
          .eq("venue_id", venueId)
          .single();
        
        console.log('[DASHBOARD] Venue query result:', { hasData: !!venueData, error: error?.message });
        
        if (!error && venueData) {
          setVenue(venueData);
          const window = todayWindowForTZ(venueData.timezone || 'Europe/London');
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
      const window = todayWindowForTZ(venue.timezone || 'Europe/London');
      setTodayWindow(window);
      loadStats(venue.venue_id, window);
    }
  }, [venue, todayWindow]);

  // Set up real-time subscription for orders (separate useEffect to avoid dependency issues)
  useEffect(() => {
    if (!venue || !todayWindow) {
      console.log('[DASHBOARD] Skipping subscription setup - venue or todayWindow not ready');
      return;
    }

    console.log('[DASHBOARD] Setting up real-time subscription with window:', todayWindow);
    
    const channel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        }, 
        (payload) => {
          console.log('Dashboard order change:', payload);
          
          // Get the order date from the payload with proper type checking
          const orderCreatedAt = (payload.new as any)?.created_at || (payload.old as any)?.created_at;
          if (!orderCreatedAt) {
            console.log('No created_at found in payload, ignoring');
            return;
          }
          
          // Only refresh stats if the order is within today's window
          const isInTodayWindow = orderCreatedAt >= todayWindow.startUtcISO && orderCreatedAt < todayWindow.endUtcISO;
          
          console.log('[DASHBOARD] Order change analysis:', {
            orderCreatedAt,
            windowStart: todayWindow.startUtcISO,
            windowEnd: todayWindow.endUtcISO,
            isInTodayWindow,
            orderId: (payload.new as any)?.id || (payload.old as any)?.id
          });
          
          if (isInTodayWindow) {
            console.log('Refreshing stats for today\'s order change');
            loadStats(venue.venue_id, todayWindow);
          } else {
            console.log('Ignoring historical order change, not refreshing stats');
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[DASHBOARD] Cleaning up real-time subscription');
      createClient().removeChannel(channel);
    };
  }, [venueId, venue?.venue_id, todayWindow?.startUtcISO]); // Use specific properties instead of objects to prevent unnecessary re-runs

  const loadStats = async (vId: string, window: any) => {
    try {
      console.log('[DASHBOARD] Loading stats for today:', window.startUtcISO, 'to', window.endUtcISO);

      const { data: orders } = await supabase
        .from("orders")
        .select("total_amount, table_number, status, payment_status, created_at, items")
        .eq("venue_id", vId)
        .gte("created_at", window.startUtcISO)
        .lt("created_at", window.endUtcISO);

      console.log('[DASHBOARD] Found orders for today:', orders?.length || 0);

      const { data: menuItems } = await supabase
        .from("menu_items")
        .select("id")
        .eq("venue_id", vId)
        .eq("available", true);

      // Calculate active tables (orders that are not served or paid AND created today)
      const todayOrders = (orders ?? []).filter((o: any) => {
        return o.status !== 'served' && o.status !== 'paid';
      });

      const activeTableSet = new Set(
        todayOrders
          .map((o: any) => o.table_number)
          .filter((t: any) => t != null)
      );

      console.log('[DASHBOARD] Active tables calculation:', {
        totalOrdersToday: orders?.length || 0,
        activeOrdersToday: todayOrders.length,
        activeTables: activeTableSet.size,
        activeTableNumbers: Array.from(activeTableSet),
        zone: window.zone
      });

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
        const ps = String(order.payment_status ?? '').toLowerCase();
        const st = String(order.status ?? '').toLowerCase();
        return (ps === 'paid' || st === 'paid') ? sum + amount : sum;
      }, 0);

      setStats({
        todayOrders: orders?.length || 0,
        revenue: todayRevenue,
        activeTables: activeTableSet.size,
        menuItems: menuItems?.length || 0,
        unpaid: (orders ?? []).filter((o: any) => String(order.payment_status ?? '').toLowerCase() !== 'paid' && String(order.status ?? '').toLowerCase() !== 'paid').length,
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Simple breadcrumb for main dashboard */}
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Welcome back, Manager!
          </h2>
          <p className="text-muted-foreground">Here's what's happening at {venue?.name || "your venue"} today</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
           <Link href={`/dashboard/${venueId}/live-orders?since=today`}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Today's Orders</p>
                    <p className="text-2xl font-bold text-foreground">{stats.todayOrders}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/analytics`}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                    <p className="text-2xl font-bold text-foreground">£{stats.revenue.toFixed(2)}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                {stats.unpaid > 0 && (
                  <div className="mt-2 text-xs text-red-600">{stats.unpaid} unpaid</div>
                )}
              </CardContent>
            </Card>
          </Link>

           <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Tables</p>
                  <p className="text-2xl font-bold text-foreground">{stats.activeTables}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Menu Items</p>
                  <p className="text-2xl font-bold text-foreground">{stats.menuItems}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href={`/dashboard/${venueId}/live-orders`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Live Orders</h3>
                <p className="text-muted-foreground text-sm">Monitor and manage incoming orders in real-time</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/menu`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <ShoppingBag className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Menu Management</h3>
                <p className="text-muted-foreground text-sm">Update your menu items and manage categories</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/generate-qr?venue=${venueId}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <QrCode className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">QR Codes</h3>
                <p className="text-muted-foreground text-sm">Generate and manage QR codes for your tables</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/analytics`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Analytics</h3>
                <p className="text-muted-foreground text-sm">View detailed reports and business insights</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/feedback`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart className="h-6 w-6 text-yellow-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Feedback</h3>
                <p className="text-muted-foreground text-sm">See customer reviews and ratings</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/staff`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-slate-700" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Staff Management</h3>
                <p className="text-muted-foreground text-sm">Add staff and manage roles</p>
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


