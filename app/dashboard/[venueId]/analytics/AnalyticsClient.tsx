"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, BarChart, TrendingUp, Clock, ShoppingBag, DollarSign, Calendar, CalendarIcon, Target, Award, TrendingDown, Download } from "lucide-react";
import MobileNav from '@/components/MobileNav';
import { toCSV, formatDateForCSV, formatCurrencyForCSV } from '@/lib/csv';
import { useCsvDownload, generateTimestampedFilename } from '@/hooks/useCsvDownload';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  menuItemsCount: number;
  revenueOverTime: Array<{ 
    date: string; 
    revenue: number; 
    orders: number;
    isCurrentPeriod?: boolean;
    isPeak?: boolean;
    isLowest?: boolean;
  }>;
  topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
  trendline: number;
  peakDay: { date: string; revenue: number };
  lowestDay: { date: string; revenue: number };
}

type TimePeriod = '7d' | '30d' | '3m' | '1y';

export default function AnalyticsClient({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d');
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    menuItemsCount: 0,
    revenueOverTime: [],
    topSellingItems: [],
    trendline: 0,
    peakDay: { date: '', revenue: 0 },
    lowestDay: { date: '', revenue: 0 }
  });
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { downloadCSV, isDownloading } = useCsvDownload();

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
      setLoading(true);
      setError(null);

      // Calculate date range based on selected period or custom range
      const { startDate, endDate } = customDateRange ? {
        startDate: new Date(customDateRange.start),
        endDate: new Date(customDateRange.end)
      } : getDateRange(timePeriod);


      // Fetch orders from selected period
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          created_at,
          order_status,
          table_number,
          payment_method,
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


      // Fetch menu items count
      const { data: menuItems, error: menuError } = await supabase
        .from('menu_items')
        .select('id')
        .eq('venue_id', venueId)
        .eq('is_available', true);

      if (menuError) {
        console.error('🔍 [ANALYTICS] Menu items error:', menuError);
      }

      // Process orders data - exclude demo orders and cancelled orders
      const validOrders = (orders || []).filter((order: any) => 
        order.order_status !== 'CANCELLED' && 
        order.total_amount > 0 &&
        order.venue_id !== 'demo-cafe' &&
        order.payment_method !== 'demo'
      );

      const totalOrders = validOrders.length;
      const totalRevenue = validOrders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const menuItemsCount = menuItems?.length || 0;

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
      
      // Generate all periods in the range
      const periods = [];
      for (let i = 0; i < daysDiff; i += interval) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        periods.push({ date: dateStr, dateObj: date });
      }
      
      // For 7-day and 30-day periods, ensure we have every single day
      if (timePeriod === '7d' || timePeriod === '30d') {
        const allDays = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          allDays.push({
            date: currentDate.toISOString().split('T')[0],
            dateObj: new Date(currentDate)
          });
          currentDate.setDate(currentDate.getDate() + 1);
        }
        periods.length = 0; // Clear the array
        periods.push(...allDays); // Add all days
      }
      
      for (const period of periods) {
        const dateStr = period.date;
        
        // Calculate revenue and order count for this period
        let periodRevenue = 0;
        let periodOrders = 0;
        let periodOrdersList: any[] = [];
        
        if (dateFormat === 'day') {
          periodOrdersList = validOrders.filter((order: any) => {
            const orderDate = order.created_at.split('T')[0];
            return orderDate === dateStr;
          });
        } else if (dateFormat === 'week') {
          const endOfWeek = new Date(period.dateObj);
          endOfWeek.setDate(period.dateObj.getDate() + 6);
          const weekEndStr = endOfWeek.toISOString().split('T')[0];
          
          periodOrdersList = validOrders.filter((order: any) => {
            const orderDate = order.created_at.split('T')[0];
            return orderDate >= dateStr && orderDate <= weekEndStr;
          });
        } else if (dateFormat === 'month') {
          const endOfMonth = new Date(period.dateObj);
          endOfMonth.setMonth(period.dateObj.getMonth() + 1, 0);
          const monthEndStr = endOfMonth.toISOString().split('T')[0];
          
          periodOrdersList = validOrders.filter((order: any) => {
            const orderDate = order.created_at.split('T')[0];
            return orderDate >= dateStr && orderDate <= monthEndStr;
          });
        }
        
        periodRevenue = periodOrdersList.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
        periodOrders = periodOrdersList.length;
        
        // Debug logging for revenue calculation (kept minimal to avoid noise)
        
        revenueOverTime.push({
          date: dateStr,
          revenue: periodRevenue,
          orders: periodOrders,
          isCurrentPeriod: false,
          isPeak: false,
          isLowest: false
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

      // Calculate trendline (average revenue)
      const trendline = revenueOverTime.length > 0 
        ? revenueOverTime.reduce((sum, period) => sum + period.revenue, 0) / revenueOverTime.length 
        : 0;

      // Find peak and lowest days
      let peakDay = { date: '', revenue: 0 };
      let lowestDay = { date: '', revenue: 0 };
      
      if (revenueOverTime.length > 0) {
        const sortedByRevenue = [...revenueOverTime].sort((a, b) => b.revenue - a.revenue);
        peakDay = { date: sortedByRevenue[0].date, revenue: sortedByRevenue[0].revenue };
        lowestDay = { date: sortedByRevenue[sortedByRevenue.length - 1].date, revenue: sortedByRevenue[sortedByRevenue.length - 1].revenue };
        
        // Mark peak and lowest days
        revenueOverTime.forEach(period => {
          if (period.date === peakDay.date) period.isPeak = true;
          if (period.date === lowestDay.date) period.isLowest = true;
        });
      }

      // Mark current period (today, this week, or this month)
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      revenueOverTime.forEach(period => {
        if (dateFormat === 'day' && period.date === todayStr) {
          period.isCurrentPeriod = true;
        } else if (dateFormat === 'week') {
          const periodDate = new Date(period.date);
          const weekStart = new Date(periodDate);
          weekStart.setDate(periodDate.getDate() - periodDate.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          
          if (now >= weekStart && now <= weekEnd) {
            period.isCurrentPeriod = true;
          }
        } else if (dateFormat === 'month') {
          const periodDate = new Date(period.date);
          if (now.getMonth() === periodDate.getMonth() && now.getFullYear() === periodDate.getFullYear()) {
            period.isCurrentPeriod = true;
          }
        }
      });



      setAnalyticsData({
        totalOrders,
        totalRevenue,
        averageOrderValue,
        menuItemsCount,
        revenueOverTime,
        topSellingItems,
        trendline,
        peakDay,
        lowestDay
      });

      // Store filtered orders for CSV export
      setFilteredOrders(validOrders);

    } catch (err: any) {
      console.error('🔍 [ANALYTICS] Error fetching analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId, timePeriod, customDateRange]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const handleExportCSV = useCallback(() => {
    if (filteredOrders.length === 0) {
      toast({
        title: "No Data to Export",
        description: "No data to export for the selected date range.",
        variant: "default"
      });
      return;
    }

    try {
      // Flatten orders into individual item rows for CSV
      const csvRows: any[] = [];
      
      filteredOrders.forEach((order: any) => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            csvRows.push({
              date: formatDateForCSV(order.created_at),
              table: order.table_number || 'N/A',
              item: item.item_name || item.name || 'Unknown Item',
              quantity: item.quantity || 0,
              price: formatCurrencyForCSV(item.price || 0),
              total: formatCurrencyForCSV((item.quantity || 0) * (item.price || 0)),
              paymentMethod: order.payment_method === 'stripe' ? 'Card' : 
                           order.payment_method === 'till' ? 'Cash' : 
                           order.payment_method === 'demo' ? 'Demo' : 
                           'Unknown'
            });
          });
        } else {
          // Order with no items (shouldn't happen but handle gracefully)
          csvRows.push({
            date: formatDateForCSV(order.created_at),
            table: order.table_number || 'N/A',
            item: 'Order Total',
            quantity: 1,
            price: formatCurrencyForCSV(order.total_amount || 0),
            total: formatCurrencyForCSV(order.total_amount || 0),
            paymentMethod: order.payment_method === 'stripe' ? 'Card' : 
                         order.payment_method === 'till' ? 'Cash' : 
                         order.payment_method === 'demo' ? 'Demo' : 
                         'Unknown'
          });
        }
      });

      // Define CSV columns
      const columns = [
        { key: 'date' as const, header: 'Date' },
        { key: 'table' as const, header: 'Table' },
        { key: 'item' as const, header: 'Item' },
        { key: 'quantity' as const, header: 'Quantity' },
        { key: 'price' as const, header: 'Price' },
        { key: 'total' as const, header: 'Total' },
        { key: 'paymentMethod' as const, header: 'Payment Method' }
      ];

      // Generate CSV
      const csv = toCSV(csvRows, columns);

      // Generate filename
      const filename = generateTimestampedFilename('servio-analytics');

      // Download CSV
      downloadCSV({ filename, csv });

      toast({
        title: "CSV Downloaded",
        description: `Analytics data exported successfully (${csvRows.length} rows).`,
        variant: "default"
      });

    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data. Please try again.",
        variant: "destructive"
      });
    }
  }, [filteredOrders, downloadCSV, toast]);

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
        return date.toLocaleDateString('en-GB', { 
          weekday: 'short', 
          day: 'numeric', 
          month: 'short' 
        });
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

  const formatXAxisLabel = (dateStr: string, period: TimePeriod, index: number, total: number) => {
    const date = new Date(dateStr);
    switch (period) {
      case '7d':
        return date.toLocaleDateString('en-GB', { weekday: 'short' });
      case '30d':
        // Show every 5th day or last day
        if (index % 5 === 0 || index === total - 1) {
          return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        }
        return '';
      case '3m':
        // Show every 4th week or last week
        if (index % 4 === 0 || index === total - 1) {
          const weekStart = new Date(date);
          const weekEnd = new Date(date);
          weekEnd.setDate(date.getDate() + 6);
          return `${weekStart.getDate()}-${weekEnd.getDate()} ${weekStart.toLocaleDateString('en-GB', { month: 'short' })}`;
        }
        return '';
      case '1y':
        // Show every 2nd month or last month
        if (index % 2 === 0 || index === total - 1) {
          return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        }
        return '';
      default:
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="mt-2 text-foreground">Loading analytics...</p>
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
          <p className="text-gray-900 mb-4">{error}</p>
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
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Time period:</span>
            <Select value={timePeriod} onValueChange={(value: TimePeriod) => {
              setTimePeriod(value);
              setCustomDateRange(null);
            }}>
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
            <span className="text-sm text-muted-foreground">or</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-40 justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateRange ? 
                    `${new Date(customDateRange.start).toLocaleDateString()} - ${new Date(customDateRange.end).toLocaleDateString()}` : 
                    "Custom range"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={customDateRange?.start || ''}
                      onChange={(e) => setCustomDateRange(prev => ({ 
                        start: e.target.value, 
                        end: prev?.end || new Date().toISOString().split('T')[0] 
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={customDateRange?.end || ''}
                      onChange={(e) => setCustomDateRange(prev => ({ 
                        start: prev?.start || new Date().toISOString().split('T')[0], 
                        end: e.target.value 
                      }))}
                    />
                  </div>
                  <Button 
                    onClick={() => {
                      if (customDateRange?.start && customDateRange?.end) {
                        setTimePeriod('7d'); // Reset to trigger refresh
                      }
                    }}
                    className="w-full"
                  >
                    Apply Custom Range
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleExportCSV}
            disabled={filteredOrders.length === 0 || isDownloading}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-white text-sm hover:bg-purple-700 disabled:opacity-50"
            title="Exports the rows you're viewing"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? 'Generating...' : 'Download CSV'}
          </Button>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-900">Last updated:</span>
            <span className="text-sm font-medium text-gray-900">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">Total Orders</p>
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
                <p className="text-sm font-semibold text-gray-900">Total Revenue</p>
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
                <p className="text-sm font-semibold text-gray-900">Average Order</p>
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
                <p className="text-sm font-semibold text-gray-900">Menu Items</p>
                <p className="text-2xl font-bold text-foreground">{analyticsData.menuItemsCount}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue Over Time Chart - Wider */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Revenue & Orders Over Time - {getTimePeriodLabel(timePeriod)}</CardTitle>
              <div className="flex items-center space-x-4 text-sm">
                {analyticsData.peakDay.revenue > 0 && (
                  <div className="flex items-center space-x-1 text-green-600">
                    <Award className="h-4 w-4" />
                    <span>Peak: £{analyticsData.peakDay.revenue.toFixed(2)}</span>
                  </div>
                )}
                {analyticsData.lowestDay.revenue > 0 && analyticsData.lowestDay.revenue !== analyticsData.peakDay.revenue && (
                  <div className="flex items-center space-x-1 text-orange-600">
                    <TrendingDown className="h-4 w-4" />
                    <span>Low: £{analyticsData.lowestDay.revenue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-80">
              {analyticsData.revenueOverTime.length > 0 ? (
                <div className="h-full relative">
                  {/* Chart Area */}
                  <div className="h-64 relative">
                    {/* Trendline */}
                    {analyticsData.trendline > 0 && (
                      <div 
                        className="absolute w-full border-t-2 border-dashed border-gray-300 opacity-50"
                        style={{ 
                          bottom: `${(analyticsData.trendline / Math.max(...analyticsData.revenueOverTime.map(d => d.revenue))) * 100}%` 
                        }}
                      />
                    )}
                    
                    {/* Chart Bars and Lines */}
                    <div className="h-full flex items-end justify-between space-x-1 relative">
                      {analyticsData.revenueOverTime.map((period, index) => {
                        const maxRevenue = Math.max(...analyticsData.revenueOverTime.map(d => d.revenue));
                        const maxOrders = Math.max(...analyticsData.revenueOverTime.map(d => d.orders));
                        
                        const revenueHeight = maxRevenue > 0 ? (period.revenue / maxRevenue) * 100 : 0;
                        const ordersHeight = maxOrders > 0 ? (period.orders / maxOrders) * 100 : 0;
                        
                        const isHovered = hoveredPoint === index;
                        const barColor = period.isPeak ? 'bg-green-500' : 
                                        period.isLowest ? 'bg-orange-500' : 
                                        period.isCurrentPeriod ? 'bg-purple-600' : 'bg-purple-500';
                        
                        return (
                          <div 
                            key={index} 
                            className="flex flex-col items-center flex-1 group cursor-pointer"
                            onMouseEnter={() => setHoveredPoint(index)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          >
                            {/* Order Count Bars (background) */}
                            <div 
                              className="w-full bg-blue-200 rounded-t transition-all duration-300"
                              style={{ 
                                height: `${Math.max(ordersHeight * 0.6, 2)}%`,
                                minHeight: period.orders > 0 ? '8px' : '2px'
                              }}
                            />
                            
                            {/* Revenue Bars (foreground) */}
                            <div 
                              className={`w-full ${barColor} rounded-t transition-all duration-300 ${isHovered ? 'ring-2 ring-purple-300' : ''}`}
                              style={{ 
                                height: `${Math.max(revenueHeight, 2)}%`,
                                minHeight: period.revenue > 0 ? '12px' : '4px'
                              }}
                            />
                            
                            {/* Peak/Lowest Badges */}
                            {period.isPeak && (
                              <div className="absolute -top-6 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                                Peak £{period.revenue.toFixed(2)}
                              </div>
                            )}
                            {period.isLowest && period.revenue !== analyticsData.peakDay.revenue && (
                              <div className="absolute -top-6 bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-medium">
                                Low £{period.revenue.toFixed(2)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* X-axis Labels */}
                  <div className="h-16 flex items-start justify-between space-x-1 mt-2">
                    {analyticsData.revenueOverTime.map((period, index) => {
                      const label = formatXAxisLabel(period.date, timePeriod, index, analyticsData.revenueOverTime.length);
                      if (!label) return <div key={index} className="flex-1" />;
                      
                      return (
                        <div key={index} className="flex-1 text-center">
                          <span className="text-xs text-muted-foreground">
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Hover Tooltip */}
                  {hoveredPoint !== null && (
                    <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10">
                      <div className="text-sm font-medium text-gray-900">
                        {formatTooltipDate(analyticsData.revenueOverTime[hoveredPoint].date, timePeriod)}
                      </div>
                      <div className="text-sm text-gray-900 mt-1">
                        Revenue: £{analyticsData.revenueOverTime[hoveredPoint].revenue.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-900">
                        Orders: {analyticsData.revenueOverTime[hoveredPoint].orders}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <BarChart className="h-12 w-12 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-900">No revenue data available</p>
                    <p className="text-sm text-gray-700 mt-1">Try selecting a different time period</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Chart Legend */}
            <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-500 rounded"></div>
                <span className="text-muted-foreground">Revenue</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-200 rounded"></div>
                <span className="text-muted-foreground">Orders</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-1 bg-gray-300 border-dashed border-t-2"></div>
                <span className="text-muted-foreground">Average</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Items Chart - Side by side */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-80">
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
                    <ShoppingBag className="h-12 w-12 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-900">No sales data available</p>
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
            <BarChart className="h-16 w-16 text-gray-700 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Analytics Data Yet</h3>
            <p className="text-gray-900 mb-6 max-w-md mx-auto">
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
      
      {/* Mobile Navigation */}
      <MobileNav 
        venueId={venueId}
        venueName={venueName}
        counts={{
          live_orders: 0,
          total_orders: 0,
          notifications: 0
        }}
      />
    </div>
  );
}
