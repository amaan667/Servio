"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, BarChart, TrendingUp, Clock, ShoppingBag, DollarSign } from "lucide-react";

interface AnalyticsData {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  menuItemsCount: number;
  revenueOverTime: Array<{ date: string; revenue: number }>;
  topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
}

export default function AnalyticsClient({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    menuItemsCount: 0,
    revenueOverTime: [],
    topSellingItems: []
  });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchAnalyticsData = useCallback(async () => {
    try {
      console.log('🔍 [ANALYTICS] Fetching analytics data for venue:', venueId);
      setLoading(true);
      setError(null);

      // Calculate date range for last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      console.log('🔍 [ANALYTICS] Date range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Fetch orders from last 30 days
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          created_at,
          order_status,
          items
        `)
        .eq('venue_id', venueId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('🔍 [ANALYTICS] Orders error:', ordersError);
        throw new Error(`Failed to fetch orders: ${ordersError.message}`);
      }

      console.log('🔍 [ANALYTICS] Orders fetched:', orders?.length || 0);

      // Fetch menu items count
      const { data: menuItems, error: menuError } = await supabase
        .from('menu_items')
        .select('id')
        .eq('venue_id', venueId)
        .eq('available', true);

      if (menuError) {
        console.error('🔍 [ANALYTICS] Menu items error:', menuError);
      }

      // Process orders data
      const validOrders = (orders || []).filter(order => 
        order.order_status !== 'CANCELLED' && order.total_amount > 0
      );

      const totalOrders = validOrders.length;
      const totalRevenue = validOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const menuItemsCount = menuItems?.length || 0;

      console.log('🔍 [ANALYTICS] Calculated stats:', {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        menuItemsCount
      });

      // Generate revenue over time data (last 30 days)
      const revenueOverTime = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayRevenue = validOrders
          .filter(order => order.created_at.startsWith(dateStr))
          .reduce((sum, order) => sum + (order.total_amount || 0), 0);
        
        revenueOverTime.push({
          date: dateStr,
          revenue: dayRevenue
        });
      }

      // Generate top selling items data
      const itemSales = new Map<string, { name: string; quantity: number; revenue: number }>();
      
      validOrders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const itemName = item.item_name || item.name || 'Unknown Item';
            const quantity = item.quantity || 0;
            const price = item.price || 0;
            const revenue = quantity * price;
            
            if (itemSales.has(itemName)) {
              const existing = itemSales.get(itemName)!;
              existing.quantity += quantity;
              existing.revenue += revenue;
            } else {
              itemSales.set(itemName, { name: itemName, quantity, revenue });
            }
          });
        }
      });

      const topSellingItems = Array.from(itemSales.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      console.log('🔍 [ANALYTICS] Generated charts data:', {
        revenueOverTimeDays: revenueOverTime.length,
        topSellingItemsCount: topSellingItems.length
      });

      setAnalyticsData({
        totalOrders,
        totalRevenue,
        averageOrderValue,
        menuItemsCount,
        revenueOverTime,
        topSellingItems
      });

    } catch (err: any) {
      console.error('🔍 [ANALYTICS] Error fetching analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <BarChart className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Analytics</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchAnalyticsData} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Period Selector */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Time period:</span>
          <span className="text-sm font-medium">Last 30 days</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Last updated:</span>
          <span className="text-sm font-medium">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold text-foreground">{analyticsData.totalOrders}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-foreground">£{analyticsData.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Order</p>
                <p className="text-2xl font-bold text-foreground">£{analyticsData.averageOrderValue.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Menu Items</p>
                <p className="text-2xl font-bold text-foreground">{analyticsData.menuItemsCount}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Over Time Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-64">
              {analyticsData.revenueOverTime.length > 0 ? (
                <div className="h-full flex items-end justify-between space-x-1">
                  {analyticsData.revenueOverTime.map((day, index) => {
                    const maxRevenue = Math.max(...analyticsData.revenueOverTime.map(d => d.revenue));
                    const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                    
                    return (
                      <div key={index} className="flex flex-col items-center flex-1">
                        <div 
                          className="w-full bg-purple-500 rounded-t transition-all duration-300 hover:bg-purple-600"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${day.date}: £${day.revenue.toFixed(2)}`}
                        />
                        {index % 5 === 0 && (
                          <span className="text-xs text-muted-foreground mt-1 transform -rotate-45 origin-left">
                            {new Date(day.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <BarChart className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No revenue data available</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Items Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-64">
              {analyticsData.topSellingItems.length > 0 ? (
                <div className="space-y-3">
                  {analyticsData.topSellingItems.slice(0, 8).map((item, index) => {
                    const maxQuantity = Math.max(...analyticsData.topSellingItems.map(i => i.quantity));
                    const width = maxQuantity > 0 ? (item.quantity / maxQuantity) * 100 : 0;
                    
                    return (
                      <div key={index} className="flex items-center space-x-3">
                        <div className="w-20 text-sm text-muted-foreground truncate">
                          {item.name}
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                          <div 
                            className="bg-orange-500 h-4 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(width, 5)}%` }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                            {item.quantity}
                          </div>
                        </div>
                        <div className="w-16 text-sm text-muted-foreground text-right">
                          £{item.revenue.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No sales data available</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* No Data State */}
      {analyticsData.totalOrders === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Analytics Data Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Analytics will appear here once you start receiving orders. 
              Generate QR codes and start taking orders to see your business insights.
            </p>
            <div className="flex justify-center space-x-4">
              <Button asChild>
                <Link href={`/generate-qr?venue=${venueId}`}>Generate QR Codes</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/dashboard/${venueId}/live-orders`}>View Live Orders</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
