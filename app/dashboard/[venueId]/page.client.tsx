"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { Clock, Users, TrendingUp, ShoppingBag, BarChart, QrCode, Settings, Plus, Table, Wifi, WifiOff, AlertTriangle, ChefHat, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
import { todayWindowForTZ } from "@/lib/time";
import { useDashboardPrefetch } from '@/hooks/usePrefetch';
import PullToRefresh from '@/components/PullToRefresh';
import { withSupabaseRetry } from '@/lib/retry';
import { useConnectionMonitor } from '@/lib/connection-monitor';
import { DashboardSkeleton } from '@/components/dashboard-skeleton';
import { useRequestCancellation } from '@/lib/request-utils';
import OnboardingCompletionBanner from '@/components/onboarding-completion-banner';
import TrialStatusBanner from '@/components/TrialStatusBanner';

interface DashboardCounts {
  live_count: number;
  earlier_today_count: number;
  history_count: number;
  today_orders_count: number;
  active_tables_count: number;
  tables_set_up: number;
  tables_in_use: number;
  tables_reserved_now: number;
}

interface DashboardStats {
  revenue: number;
  menuItems: number;
  unpaid: number;
}

const VenueDashboardClient = React.memo(function VenueDashboardClient({ 
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
  const [loading, setLoading] = useState(false); // Always start with loading false for instant loading
  const [counts, setCounts] = useState<DashboardCounts>(initialCounts || {
    live_count: 0,
    earlier_today_count: 0,
    history_count: 0,
    today_orders_count: 0,
    active_tables_count: 0,
    tables_set_up: 0,
    tables_in_use: 0,
    tables_reserved_now: 0
  });
  const [stats, setStats] = useState<DashboardStats>(initialStats || { revenue: 0, menuItems: 0, unpaid: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [todayWindow, setTodayWindow] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Monitor connection status
  const connectionState = useConnectionMonitor();
  
  // Request cancellation
  const { createRequest, cancelRequest } = useRequestCancellation();
  
  // Enable intelligent prefetching for dashboard routes
  useDashboardPrefetch(venueId);

  useEffect(() => {
    const loadVenueAndStats = async () => {
      try {
        // Check if we already have venue data from SSR
        if (venue && !loading) {
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
        
        if (!error && venueData) {
          setVenue(venueData);
          const window = todayWindowForTZ(venueTz);
          setTodayWindow(window);
          await loadStats(venueData.venue_id, window);
        } else {
          // Set loading to false even on error to prevent infinite loading
          setLoading(false);
        }
      } catch (error) {
        // Set loading to false even on error to prevent infinite loading
        setLoading(false);
      }
    };

    loadVenueAndStats();
  }, [venueId]);

  // Handle initial venue data from SSR
  useEffect(() => {
    if (initialVenue && !venue) {
      setVenue(initialVenue);
      setLoading(false);
    }
  }, [initialVenue, venue]);

  // Set up time window when venue data is available
  useEffect(() => {
    if (venue && !todayWindow) {
      const window = todayWindowForTZ(venueTz);
      setTodayWindow(window);
      loadStats(venue.venue_id, window);
    }
  }, [venue, todayWindow, venueTz]);

  // Reset stats and clear tables when day changes to ensure fresh data
  useEffect(() => {
    if (todayWindow) {
      const checkDayChange = async () => {
        const now = new Date();
        const currentDay = now.toDateString();
        const lastDay = new Date(todayWindow.startUtcISO).toDateString();
        
        if (currentDay !== lastDay) {
          setStatsLoaded(false);
          setStats({ revenue: 0, menuItems: 0, unpaid: 0 });
          
          // Clear all tables and sessions for new day
          if (venue) {
            try {
              const response = await fetch('/api/tables/clear-all', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ venue_id: venue.venue_id }),
              });

              if (response.ok) {
              } else {
                console.error('[DASHBOARD] Failed to clear all tables and sessions:', response.status);
              }
            } catch (error) {
              console.error('[DASHBOARD] Error clearing all tables and sessions:', error);
            }

            // Reload stats for new day
            const newWindow = todayWindowForTZ(venueTz);
            setTodayWindow(newWindow);
            loadStats(venue.venue_id, newWindow);
          }
        }
      };
      
      // Check every minute for day change
      const interval = setInterval(checkDayChange, 120000);
      return () => clearInterval(interval);
    }
  }, [todayWindow, venue, venueTz]);

  // Set up real-time subscription for orders to update counts and revenue instantly
  useEffect(() => {
    if (!venue || !todayWindow) {
      return;
    }

    
    const channel = createClient()
      .channel('dashboard-orders')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        }, 
        async (payload: any) => {
          
          // Get the order date from the payload with proper type checking
          const orderCreatedAt = (payload.new as any)?.created_at || (payload.old as any)?.created_at;
          if (!orderCreatedAt) {
            return;
          }
          
          // Only refresh counts if the order is within today's window
          const isInTodayWindow = orderCreatedAt >= todayWindow.startUtcISO && orderCreatedAt < todayWindow.endUtcISO;
          
          if (isInTodayWindow) {
            
            // Always refresh counts for any order change
            await refreshCounts();
            
            // Update revenue incrementally for new orders to prevent flickering
            if (payload.event === 'INSERT' && payload.new) {
              updateRevenueIncrementally(payload.new);
            } else if (payload.event === 'UPDATE' && payload.new) {
              // For order updates, we might need to recalculate revenue if order status changed
              // If order was cancelled or refunded, we should recalculate total revenue
              if (payload.new.order_status === 'CANCELLED' || payload.new.order_status === 'REFUNDED') {
                await loadStats(venue.venue_id, todayWindow);
              }
            }
          } else {
          }
        }
      )
      .subscribe();

    // Also listen for custom order events from other components
    const handleOrderCreated = (event: CustomEvent) => {
      if (event.detail.venueId === venueId) {
        // Trigger immediate refresh of counts and revenue
        refreshCounts();
        if (event.detail.order) {
          updateRevenueIncrementally(event.detail.order);
        }
      }
    };

    window.addEventListener('orderCreated', handleOrderCreated as EventListener);

    return () => {
      createClient().removeChannel(channel);
      window.removeEventListener('orderCreated', handleOrderCreated as EventListener);
    };
  }, [venueId, venue?.venue_id, todayWindow?.startUtcISO, venueTz]); // Use specific properties instead of objects to prevent unnecessary re-runs


  // Function to refresh counts using the new RPC with retry logic
  const refreshCounts = async () => {
    try {
      setError(null);
      const supabase = createClient();
      
      // Use retry logic for dashboard counts
      const { data: newCounts, error } = await withSupabaseRetry(
        () => supabase.rpc('dashboard_counts', { 
          p_venue_id: venueId, 
          p_tz: venueTz, 
          p_live_window_mins: 30 
        }).single()
      );
      
      if (error) {
        console.warn('[DASHBOARD] Failed to refresh counts:', error);
        setError('Failed to refresh dashboard data');
        return;
      }

      // Also get table counters for consistency with retry
      const { data: tableCounters, error: tableCountersError } = await withSupabaseRetry(
        () => supabase.rpc('api_table_counters', {
          p_venue_id: venueId
        })
      );

      // Ensure newCounts is properly typed
      if (newCounts && typeof newCounts === 'object') {
        const counts = newCounts as DashboardCounts;
        
        if (!tableCountersError && tableCounters && Array.isArray(tableCounters) && tableCounters.length > 0) {
          const tableCounter = tableCounters[0] as any;
          // Override table counts with consistent data
          counts.tables_set_up = Number(tableCounter.total_tables) || 0;
          counts.tables_in_use = Number(tableCounter.occupied) || 0;
          counts.active_tables_count = Number(tableCounter.total_tables) || 0;
        }
        
        setCounts(counts);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  // Function to update revenue incrementally when new orders come in
  const updateRevenueIncrementally = (newOrder: any) => {
    if (!newOrder || !statsLoaded) return;
    
    try {
      let amount = Number(newOrder.total_amount) || parseFloat(newOrder.total_amount as any) || 0;
      if (!Number.isFinite(amount) || amount <= 0) {
        if (Array.isArray(newOrder.items)) {
          amount = newOrder.items.reduce((s: number, it: any) => {
            const unit = Number(it.unit_price ?? it.price ?? 0);
            const qty = Number(it.quantity ?? it.qty ?? 0);
            return s + (Number.isFinite(unit) && Number.isFinite(qty) ? unit * qty : 0);
          }, 0);
        }
      }
      
      if (amount > 0) {
        setStats(prev => ({
          ...prev,
          revenue: prev.revenue + amount
        }));
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const loadStats = useCallback(async (vId: string, window: any) => {
    // If we have initial stats from SSR, use those and skip client-side calculation
    if (initialStats && initialStats.revenue > 0) {
      setStats(initialStats);
      setStatsLoaded(true);
      return;
    }

    // Only load stats once per day to prevent flickering
    if (statsLoaded) {
      return;
    }

    try {
      setError(null);
      const supabase = createClient();

      // Use retry logic for both queries
      const [ordersResult, menuItemsResult] = await Promise.all([
        withSupabaseRetry(() => supabase
          .from("orders")
          .select("total_amount, table_number, order_status, payment_status, created_at, items")
          .eq("venue_id", vId)
          .gte("created_at", window.startUtcISO)
          .lt("created_at", window.endUtcISO)
        ),
        withSupabaseRetry(() => supabase
          .from("menu_items")
          .select("id")
          .eq("venue_id", vId)
          .eq("available", true)
        )
      ]);

      const { data: orders, error: ordersError } = ordersResult;
      const { data: menuItems, error: menuItemsError } = menuItemsResult;

      if (ordersError || menuItemsError) {
        console.warn('[DASHBOARD] Failed to load stats:', { ordersError, menuItemsError });
        setError('Failed to load dashboard statistics');
        return;
      }

      // Calculate revenue from today's paid orders only (robust amount fallback)
      const ordersArray = Array.isArray(orders) ? orders : [];
      const todayRevenue = ordersArray.reduce((sum: number, order: any) => {
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

      const menuItemsArray = Array.isArray(menuItems) ? menuItems : [];
      setStats({
        revenue: todayRevenue,
        menuItems: menuItemsArray.length,
        unpaid: 0, // All orders are now paid since they only appear after payment
      });
      
      setStatsLoaded(true);
    } catch (error) {
      console.error('[DASHBOARD] Error loading stats:', error);
      setError('Failed to load dashboard statistics');
    }
  }, [initialStats, statsLoaded]);


  // Show skeleton while loading or if no venue data
  if (loading || !venue) {
    return <DashboardSkeleton />;
  }

  const handleRefresh = async () => {
    // Refresh dashboard data
    await loadStats(venueId, todayWindow);
    await refreshCounts();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 pb-24 md:pb-8">
        {/* Simple breadcrumb for main dashboard */}
        <NavigationBreadcrumb venueId={venueId} />
        
        {/* Onboarding completion banner */}
        <OnboardingCompletionBanner />
        
        {/* Trial status banner */}
        <TrialStatusBanner />
        
        <div className="mb-6 sm:mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                Welcome back, {userName}!
              </h2>
              <p className="text-gray-700 text-sm sm:text-base font-medium">Here's what's happening at {venue?.name || "your venue"} today</p>
            </div>
            
            {/* Connection Status Indicator */}
            <div className="flex items-center gap-2 text-xs">
              {!connectionState.isOnline ? (
                <div className="flex items-center gap-1 text-red-600">
                  <WifiOff className="h-4 w-4" />
                  <span>Offline</span>
                </div>
              ) : connectionState.isSlowConnection ? (
                <div className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Slow</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-green-600">
                  <Wifi className="h-4 w-4" />
                  <span>Online</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Error Banner */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-800">{error}</span>
                <button
                  onClick={handleRefresh}
                  className="ml-auto text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
           <Link href={`/dashboard/${venueId}/live-orders?since=today`}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-700">Today's Orders</p>
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
                    <p className="text-xs sm:text-sm font-medium text-gray-700">Revenue</p>
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

           <Link href={`/dashboard/${venueId}/tables`}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-700">Tables Set Up</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{counts.tables_set_up}</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Table className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
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
                    <p className="text-xs sm:text-sm font-medium text-gray-700">Menu Items</p>
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
                <p className="text-gray-700 text-xs sm:text-sm font-medium">Monitor and manage incoming orders in real-time</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/kds`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <ChefHat className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Kitchen Display</h3>
                <p className="text-gray-700 text-xs sm:text-sm font-medium">Manage kitchen prep stations and ticket flow</p>
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
                <p className="text-gray-700 text-xs sm:text-sm font-medium">Update your menu items and manage categories</p>
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
                <p className="text-gray-700 text-xs sm:text-sm font-medium">Generate and manage QR codes for your tables</p>
              </CardContent>
            </Card>
          </Link>

          {venue?.has_tables !== false && (
            <Link 
              href={`/dashboard/${venueId}/tables`}
              onClick={() => {
                // Track table management click
              }}
            >
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                    <Table className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Table Management</h3>
                  <p className="text-gray-700 text-xs sm:text-sm font-medium">Monitor table status and manage service flow</p>
                </CardContent>
              </Card>
            </Link>
          )}

          <Link href={`/dashboard/${venueId}/analytics`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Analytics</h3>
                <p className="text-gray-700 text-xs sm:text-sm font-medium">View detailed reports and business insights</p>
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
                <p className="text-gray-700 text-xs sm:text-sm font-medium">See customer reviews and ratings</p>
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
                <p className="text-gray-700 text-xs sm:text-sm font-medium">Add staff and manage roles</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/inventory`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <Package className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Inventory Management</h3>
                <p className="text-gray-700 text-xs sm:text-sm font-medium">Track ingredients, stock levels, and costs</p>
              </CardContent>
            </Card>
          </Link>

        </div>

        {/* Getting Started Section */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-foreground">Getting Started</h3>
              <p className="text-gray-700 font-medium">Complete these steps to set up your venue</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Plus className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">Add Menu Items</h4>
                    <p className="text-sm text-gray-700 font-medium">Upload your menu or add items manually</p>
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
                    <p className="text-sm text-gray-700 font-medium">Create QR codes for your tables</p>
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
                    <p className="text-sm text-gray-900 font-medium">Customize your venue settings</p>
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
    </PullToRefresh>
  );
});

export default VenueDashboardClient;


