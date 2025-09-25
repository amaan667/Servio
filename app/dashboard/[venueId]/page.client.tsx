"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { Clock, Users, TrendingUp, ShoppingBag, BarChart, QrCode, Settings, Plus, Table } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
import { todayWindowForTZ } from "@/lib/time";

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
  const router = useRouter();

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
        return;
      }

      // Also get table counters for consistency
      const { data: tableCounters, error: tableCountersError } = await supabase
        .rpc('api_table_counters', {
          p_venue_id: venueId
        });

      if (!tableCountersError && tableCounters?.[0]) {
        const tableCounter = tableCounters[0];
        // Override table counts with consistent data
        newCounts.tables_set_up = Number(tableCounter.total_tables) || 0;
        newCounts.tables_in_use = Number(tableCounter.occupied) || 0;
        newCounts.active_tables_count = Number(tableCounter.total_tables) || 0;
      }
      
      setCounts(newCounts);
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

  const loadStats = async (vId: string, window: any) => {
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

      const { data: orders } = await createClient()
        .from("orders")
        .select("total_amount, table_number, order_status, payment_status, created_at, items")
        .eq("venue_id", vId)
        .gte("created_at", window.startUtcISO)
        .lt("created_at", window.endUtcISO);


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
      
      setStatsLoaded(true);
    } catch (error) {
      // Silent error handling
    }
  };


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

           <Link href={`/dashboard/${venueId}/tables`}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Tables Set Up</p>
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
                  <p className="text-muted-foreground text-xs sm:text-sm">Monitor table status and manage service flow</p>
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


