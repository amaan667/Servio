"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { Clock, Users, TrendingUp, ShoppingBag, BarChart, QrCode, Settings, Plus } from "lucide-react";
import { supabase } from "@/lib/sb-client";
import { NavBar } from "@/components/NavBar";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";

export default function VenueDashboardClient({ venueId, userId, activeTables: activeTablesFromSSR = 0 }: { venueId: string; userId: string; activeTables?: number }) {
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ todayOrders: 0, revenue: 0, activeTables: activeTablesFromSSR, menuItems: 0, unpaid: 0 });
  const router = useRouter();

  useEffect(() => {
    const loadVenueAndStats = async () => {
      // Load venue data and stats (userId already verified by SSR)
      const { data: venueData, error } = await supabase
        .from("venues")
        .select("*")
        .eq("venue_id", venueId)
        .single();
      
      if (!error && venueData) {
        setVenue(venueData);
        await loadStats(venueData.venue_id);
      }

      setLoading(false);
    };

    loadVenueAndStats();

    // Set up real-time subscription for orders
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
          
          // Get the order date from the payload
          const orderCreatedAt = payload.new?.created_at || payload.old?.created_at;
          if (!orderCreatedAt) {
            console.log('No created_at found in payload, ignoring');
            return;
          }
          
          // Only refresh stats if the order is from today
          const orderDate = new Date(orderCreatedAt);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const orderDateOnly = new Date(orderDate);
          orderDateOnly.setHours(0, 0, 0, 0);
          
          const isToday = orderDateOnly.getTime() === today.getTime();
          
          console.log('[DASHBOARD] Order change analysis:', {
            orderCreatedAt,
            orderDateOnly: orderDateOnly.toISOString(),
            today: today.toISOString(),
            isToday,
            orderId: payload.new?.id || payload.old?.id
          });
          
          if (isToday && venue) {
            console.log('Refreshing stats for today\'s order change');
            loadStats(venue.venue_id);
          } else {
            console.log('Ignoring historical order change, not refreshing stats');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, venue]);

  const loadStats = async (vId: string) => {
    try {
      // Get start of today in local timezone
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfToday = today.toISOString();

      console.log('[DASHBOARD] Loading stats for today:', startOfToday);

      const { data: orders } = await supabase
        .from("orders")
        .select("total_amount, table_number, status, payment_status, created_at")
        .eq("venue_id", vId)
        .gte("created_at", startOfToday);

      console.log('[DASHBOARD] Found orders for today:', orders?.length || 0);

      const { data: menuItems } = await supabase
        .from("menu_items")
        .select("id")
        .eq("venue_id", vId)
        .eq("available", true);

      // Calculate active tables (orders that are not served or paid AND created today)
      const todayOrders = (orders ?? []).filter((o: any) => {
        // Only count orders from today that are not served or paid
        const orderDate = new Date(o.created_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const orderDateOnly = new Date(orderDate);
        orderDateOnly.setHours(0, 0, 0, 0);
        
        const isToday = orderDateOnly.getTime() === today.getTime();
        return isToday && o.status !== 'served' && o.status !== 'paid';
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
        activeTableNumbers: Array.from(activeTableSet)
      });

      // Calculate revenue from today's orders
      const todayRevenue = (orders ?? []).reduce((sum: number, order: any) => {
        const amount = parseFloat(order.total_amount as any) || 0;
        return sum + amount;
      }, 0);

      setStats({
        todayOrders: orders?.length || 0,
        revenue: todayRevenue,
        activeTables: activeTableSet.size,
        menuItems: menuItems?.length || 0,
        unpaid: (orders ?? []).filter((o: any) => (o.payment_status ?? 'unpaid') !== 'paid').length,
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
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb showBackButton={false} />
        
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, Manager!
          </h2>
          <p className="text-gray-600">Here's what's happening at {venue?.name || "your venue"} today</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
           <Card>
            <CardContent className="p-6 cursor-pointer" onClick={() => router.push(`/dashboard/${venueId}/live-orders?since=today`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.todayOrders}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 cursor-pointer" onClick={() => router.push(`/dashboard/${venueId}/analytics`)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">£{stats.revenue.toFixed(2)}</p>
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

           <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Tables</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeTables}</p>
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
                  <p className="text-sm font-medium text-gray-600">Menu Items</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.menuItems}</p>
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
                <h3 className="text-lg font-semibold mb-2">Live Orders</h3>
                <p className="text-gray-500 text-sm">Monitor and manage incoming orders in real-time</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/menu`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <ShoppingBag className="h-6 w-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Menu Management</h3>
                <p className="text-gray-500 text-sm">Update your menu items and manage categories</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/qr-codes`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <QrCode className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">QR Codes</h3>
                <p className="text-gray-500 text-sm">Generate and manage QR codes for your tables</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/analytics`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Analytics</h3>
                <p className="text-gray-500 text-sm">View detailed reports and business insights</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/staff`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-slate-700" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Staff Management</h3>
                <p className="text-gray-500 text-sm">Add staff and manage roles</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Getting Started Section */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Getting Started</h3>
              <p className="text-gray-500">Complete these steps to set up your venue</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Plus className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Add Menu Items</h4>
                    <p className="text-sm text-gray-500">Upload your menu or add items manually</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => router.push(`/dashboard/${venueId}/menu?openAdd=true`)}>
                  Get Started
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <QrCode className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Generate QR Codes</h4>
                    <p className="text-sm text-gray-500">Create QR codes for your tables</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => router.push(`/dashboard/${venueId}/qr-codes`)}>
                  Generate
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Settings className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">Configure Settings</h4>
                    <p className="text-sm text-gray-500">Customize your venue settings</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => router.push(`/settings`)}>
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


