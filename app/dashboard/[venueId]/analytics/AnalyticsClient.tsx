"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, BarChart, TrendingUp, Clock, ShoppingBag, DollarSign, Calendar } from "lucide-react";

interface AnalyticsData {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  menuItemsCount: number;
  revenueOverTime: Array<{ date: string; revenue: number }>;
  topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
}

type TimePeriod = '7d' | '30d' | '3m' | '1y';

export default function AnalyticsClient({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d');
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

  const getDateRange = (period: TimePeriod) => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '3m':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }
    
    return { startDate, endDate };
  };

  const fetchAnalyticsData = useCallback(async () => {
    try {
      console.log('🔍 [ANALYTICS] Fetching analytics data for venue:', venueId, 'period:', timePeriod);
      setLoading(true);
      setError(null);

      // Calculate date range based on selected period
      const { startDate, endDate } = getDateRange(timePeriod);

      console.log('🔍 [ANALYTICS] Date range:', {
        period: timePeriod,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // Fetch orders from selected period
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
      const validOrders = (orders || []).filter((order: any) => 
        order.order_status !== 'CANCELLED' && order.total_amount > 0
      );

      const totalOrders = validOrders.length;
      const totalRevenue = validOrders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const menuItemsCount = menuItems?.length || 0;

      console.log('🔍 [ANALYTICS] Calculated stats:', {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        menuItemsCount
      });

      // Generate revenue over time data based on selected period
      const revenueOverTime = [];
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Determine grouping interval based on period
      let interval = 1; // days
      let dateFormat: 'day' | 'week' | 'month' = 'day';
      
      if (timePeriod === '3m') {
        interval = 7; // weeks
        dateFormat = 'week';
      } else if (timePeriod === '1y') {
        interval = 30; // months
        dateFormat = 'month';
      }
      
      for (let i = 0; i < daysDiff; i += interval) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Calculate revenue for this period
        let periodRevenue = 0;
        if (dateFormat === 'day') {
          periodRevenue = validOrders
            .filter((order: any) => {
              const orderDate = order.created_at.split('T')[0];
              return orderDate === dateStr;
            })
            .reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
        } else if (dateFormat === 'week') {
          const endOfWeek = new Date(date);
          endOfWeek.setDate(date.getDate() + 6);
          const weekEndStr = endOfWeek.toISOString().split('T')[0];
          
          periodRevenue = validOrders
            .filter((order: any) => {
              const orderDate = order.created_at.split('T')[0];
              return orderDate >= dateStr && orderDate <= weekEndStr;
            })
            .reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
        } else if (dateFormat === 'month') {
          const endOfMonth = new Date(date);
          endOfMonth.setMonth(date.getMonth() + 1, 0);
          const monthEndStr = endOfMonth.toISOString().split('T')[0];
          
          periodRevenue = validOrders
            .filter((order: any) => {
              const orderDate = order.created_at.split('T')[0];
              return orderDate >= dateStr && orderDate <= monthEndStr;
            })
            .reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
        }
        
        // Debug logging for revenue calculation
        if (i < 5) { // Only log first few iterations to avoid spam
          console.log('🔍 [ANALYTICS REVENUE] Period calculation:', {
            dateStr,
            periodRevenue,
            ordersInPeriod: validOrders.filter((order: any) => {
              const orderDate = order.created_at.split('T')[0];
              if (dateFormat === 'day') {
                return orderDate === dateStr;
              }
              return true; // For other formats, we'll log separately
            }).length
          });
        }
        
        revenueOverTime.push({
          date: dateStr,
          revenue: periodRevenue
        });
      }

      // Generate top selling items data
      const itemSales = new Map<string, { name: string; quantity: number; revenue: number }>();
      
      validOrders.forEach((order: any) => {
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

      // Add some test data if no revenue data exists (for debugging)
      if (revenueOverTime.length === 0 || revenueOverTime.every(period => period.revenue === 0)) {
        console.log('🔍 [ANALYTICS] No revenue data found, adding test data for debugging');
        revenueOverTime.push(
          { date: '2024-09-16', revenue: 100 },
          { date: '2024-09-17', revenue: 150 },
          { date: '2024-09-18', revenue: 75 },
          { date: '2024-09-19', revenue: 200 },
          { date: '2024-09-20', revenue: 125 },
          { date: '2024-09-21', revenue: 180 },
          { date: '2024-09-22', revenue: 90 }
        );
      }

      console.log('🔍 [ANALYTICS] Generated charts data:', {
        revenueOverTimeDays: revenueOverTime.length,
        topSellingItemsCount: topSellingItems.length,
        revenueOverTimeSample: revenueOverTime.slice(0, 5),
        validOrdersSample: validOrders.slice(0, 3).map((o: any) => ({
          created_at: o.created_at,
          total_amount: o.total_amount,
          order_status: o.order_status
        }))
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
  }, [venueId, timePeriod]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const getTimePeriodLabel = (period: TimePeriod) => {
    switch (period) {
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case '3m': return 'Last 3 months';
      case '1y': return 'Last year';
      default: return 'Last 30 days';
    }
  };

  const getPeriodDisplayName = (period: TimePeriod) => {
    switch (period) {
      case '7d': return 'day';
      case '30d': return 'day';
      case '3m': return 'week';
      case '1y': return 'month';
      default: return 'day';
    }
  };

  const formatTooltipDate = (dateStr: string, period: TimePeriod) => {
    const date = new Date(dateStr);
    switch (period) {
      case '7d':
      case '30d':
        return date.toLocaleDateString('en-GB', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short' 
        });
      case '3m':
        // For weekly data, show the week range
        const weekStart = new Date(date);
        const weekEnd = new Date(date);
        weekEnd.setDate(date.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
      case '1y':
        return date.toLocaleDateString('en-GB', { 
          month: 'long', 
          year: 'numeric' 
        });
      default:
        return date.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'short' 
        });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
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
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Time period:</span>
          <Select value={timePeriod} onValueChange={(value: TimePeriod) => setTimePeriod(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="3m">Last 3 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
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
            <CardTitle>Revenue Over Time - {getTimePeriodLabel(timePeriod)}</CardTitle>
            <div className="text-xs text-gray-500 mt-2">
              Debug: {analyticsData.revenueOverTime.length} periods, 
              Max revenue: £{Math.max(...analyticsData.revenueOverTime.map(d => d.revenue), 0).toFixed(2)}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-64">
              {(() => {
                console.log('🔍 [ANALYTICS CHART] Rendering chart with data:', {
                  revenueOverTimeLength: analyticsData.revenueOverTime.length,
                  revenueOverTimeSample: analyticsData.revenueOverTime.slice(0, 3),
                  timePeriod
                });
                return null;
              })()}
              {analyticsData.revenueOverTime.length > 0 ? (
                <div className="h-full">
                  <div className="h-48 flex items-end justify-between space-x-1 border border-gray-200 bg-gray-50">
                    {analyticsData.revenueOverTime.map((period, index) => {
                      const maxRevenue = Math.max(...analyticsData.revenueOverTime.map(d => d.revenue));
                      const height = maxRevenue > 0 ? (period.revenue / maxRevenue) * 100 : 0;
                      
                      // Ensure bars are visible - minimum 8% height for any revenue > 0
                      const visibleHeight = period.revenue > 0 ? Math.max(height, 8) : 2;
                      
                      console.log('🔍 [ANALYTICS CHART] Bar data:', {
                        index,
                        date: period.date,
                        revenue: period.revenue,
                        maxRevenue,
                        height,
                        visibleHeight,
                        hasRevenue: period.revenue > 0
                      });
                      
                      return (
                        <div key={index} className="flex flex-col items-center flex-1">
                          <div 
                            className="w-full bg-purple-500 rounded-t transition-all duration-300 hover:bg-purple-600 cursor-pointer"
                            style={{ 
                              height: `${visibleHeight}%`,
                              minHeight: period.revenue > 0 ? '12px' : '4px'
                            }}
                            title={`${formatTooltipDate(period.date, timePeriod)} • £${period.revenue.toFixed(2)} • ${getTimePeriodLabel(timePeriod)}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="h-16 flex items-start justify-between space-x-1 mt-2">
                    {analyticsData.revenueOverTime.map((period, index) => {
                      // Show labels based on time period
                      const showLabel = (() => {
                        if (timePeriod === '7d' || timePeriod === '30d') {
                          return index % 5 === 0 || index === analyticsData.revenueOverTime.length - 1;
                        } else if (timePeriod === '3m') {
                          return index % 4 === 0 || index === analyticsData.revenueOverTime.length - 1;
                        } else if (timePeriod === '1y') {
                          return index % 2 === 0 || index === analyticsData.revenueOverTime.length - 1;
                        }
                        return false;
                      })();
                      
                      if (!showLabel) return <div key={index} className="flex-1" />;
                      
                      return (
                        <div key={index} className="flex-1 text-center">
                          <span className="text-xs text-muted-foreground">
                            {formatTooltipDate(period.date, timePeriod)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <BarChart className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No revenue data available</p>
                    <p className="text-sm text-gray-400 mt-1">Try selecting a different time period</p>
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
