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
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, BarChart, TrendingUp, Clock, ShoppingBag, DollarSign, Calendar, CalendarIcon, Target, Award, TrendingDown, Download, FileText, Share2, Printer } from "lucide-react";
import { toCSV, formatDateForCSV, formatCurrencyForCSV } from '@/lib/csv';
import { useCsvDownload, generateTimestampedFilename } from '@/hooks/useCsvDownload';
import { useToast } from '@/hooks/use-toast';

interface Order {
  id: string;
  total_amount: number;
  created_at: string;
  order_items?: any[];
}

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

interface AnalyticsClientProps {
  venueId: string;
  venueName: string;
}

export default function AnalyticsClient({ venueId, venueName }: AnalyticsClientProps) {
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
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'items' | 'export'>('overview');
  const router = useRouter();
  const { toast } = useToast();

  const supabase = createClient();

  const getDateRange = useCallback((period: TimePeriod) => {
    const end = new Date();
    const start = new Date();
    
    switch (period) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '3m':
        start.setMonth(end.getMonth() - 3);
        break;
      case '1y':
        start.setFullYear(end.getFullYear() - 1);
        break;
    }
    
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  }, []);

  const loadAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      const dateRange = customDateRange || getDateRange(timePeriod);
      
      // Load orders data
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          created_at,
          order_items (
            id,
            quantity,
            price,
            menu_items (
              name
            )
          )
        `)
        .eq('venue_id', venueId)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end + 'T23:59:59')
        .order('created_at', { ascending: true });

      if (ordersError) {
        console.error('Error loading orders:', ordersError);
        return;
      }

      // Load menu items count
      const { data: menuItems, error: menuError } = await supabase
        .from('menu_items')
        .select('id')
        .eq('venue_id', venueId);

      if (menuError) {
        console.error('Error loading menu items:', menuError);
      }

      // Process data
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum: number, order: Order) => sum + (order.total_amount || 0), 0) || 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Group by date
      const revenueByDate: { [key: string]: { revenue: number; orders: number } } = {};
      orders?.forEach((order: Order) => {
        const date = order.created_at.split('T')[0];
        if (!revenueByDate[date]) {
          revenueByDate[date] = { revenue: 0, orders: 0 };
        }
        revenueByDate[date].revenue += order.total_amount || 0;
        revenueByDate[date].orders += 1;
      });

      // Convert to array and fill missing dates
      const revenueOverTime = [];
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayData = revenueByDate[dateStr] || { revenue: 0, orders: 0 };
        revenueOverTime.push({
          date: dateStr,
          revenue: dayData.revenue,
          orders: dayData.orders
        });
      }

      // Find peak and lowest days
      const peakDay = revenueOverTime.reduce((max, day) => 
        day.revenue > max.revenue ? day : max, { date: '', revenue: 0 }
      );
      const lowestDay = revenueOverTime.reduce((min, day) => 
        day.revenue < min.revenue && day.revenue > 0 ? day : min, { date: '', revenue: Infinity }
      );

      // Calculate top selling items
      const itemSales: { [key: string]: { quantity: number; revenue: number } } = {};
      orders?.forEach((order: Order) => {
        order.order_items?.forEach((item: any) => {
          const itemName = item.menu_items?.name || 'Unknown Item';
          if (!itemSales[itemName]) {
            itemSales[itemName] = { quantity: 0, revenue: 0 };
          }
          itemSales[itemName].quantity += item.quantity;
          itemSales[itemName].revenue += item.quantity * item.price;
        });
      });

      const topSellingItems = Object.entries(itemSales)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Calculate trendline (simple linear regression)
      let trendline = 0;
      if (revenueOverTime.length > 1) {
        const n = revenueOverTime.length;
        const sumX = revenueOverTime.reduce((sum, _, i) => sum + i, 0);
        const sumY = revenueOverTime.reduce((sum, day) => sum + day.revenue, 0);
        const sumXY = revenueOverTime.reduce((sum, day, i) => sum + i * day.revenue, 0);
        const sumXX = revenueOverTime.reduce((sum, _, i) => sum + i * i, 0);
        
        trendline = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      }

      setAnalyticsData({
        totalOrders,
        totalRevenue,
        averageOrderValue,
        menuItemsCount: menuItems?.length || 0,
        revenueOverTime,
        topSellingItems,
        trendline,
        peakDay,
        lowestDay
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [venueId, timePeriod, customDateRange, getDateRange, supabase, toast]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  const handleExportCSV = () => {
    const csvData = analyticsData.revenueOverTime.map(day => ({
      Date: formatDateForCSV(day.date),
      Revenue: formatCurrencyForCSV(day.revenue),
      Orders: day.orders
    }));

    const columns = [
      { key: 'Date' as const, header: 'Date' },
      { key: 'Revenue' as const, header: 'Revenue ($)' },
      { key: 'Orders' as const, header: 'Orders' }
    ];

    const csv = toCSV(csvData, columns);
    const filename = generateTimestampedFilename(`${venueName}_revenue_analytics`);
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Analytics data exported successfully",
    });
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleShareReport = () => {
    if (navigator.share) {
      navigator.share({
        title: `${venueName} Analytics Report`,
        text: `Analytics report for ${venueName}`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "Report link copied to clipboard",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/${venueId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2"
          >
            <BarChart className="h-4 w-4" />
            Overview
          </Button>
          <Button
            variant={activeTab === 'revenue' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('revenue')}
            className="flex items-center gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            Revenue
          </Button>
          <Button
            variant={activeTab === 'items' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('items')}
            className="flex items-center gap-2"
          >
            <ShoppingBag className="h-4 w-4" />
            Items
          </Button>
          <Button
            variant={activeTab === 'export' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('export')}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="flex items-center gap-4">
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
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Custom Range
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={customDateRange?.start || ''}
                  onChange={(e) => setCustomDateRange(prev => ({ 
                    start: e.target.value,
                    end: prev?.end || e.target.value
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
                    start: prev?.start || e.target.value,
                    end: e.target.value 
                  }))}
                />
              </div>
              <Button 
                onClick={() => setCustomDateRange(null)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Clear Custom Range
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <ShoppingBag className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{analyticsData.totalOrders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <DollarSign className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(analyticsData.totalRevenue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Target className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">Avg Order Value</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(analyticsData.averageOrderValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Award className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-900">Menu Items</p>
                    <p className="text-2xl font-bold text-gray-900">{analyticsData.menuItemsCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Best Day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(analyticsData.peakDay.revenue)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {analyticsData.peakDay.date ? formatDate(analyticsData.peakDay.date) : 'No data'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  Lowest Day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {analyticsData.lowestDay.revenue === Infinity ? '$0' : formatCurrency(analyticsData.lowestDay.revenue)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {analyticsData.lowestDay.date ? formatDate(analyticsData.lowestDay.date) : 'No data'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-1">
                {analyticsData.revenueOverTime.map((day, index) => {
                  const maxRevenue = Math.max(...analyticsData.revenueOverTime.map(d => d.revenue));
                  const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                  
                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center"
                      onMouseEnter={() => setHoveredPoint(index)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all duration-200 hover:bg-blue-600"
                        style={{ height: `${height}%` }}
                      />
                      {hoveredPoint === index && (
                        <div className="absolute bg-gray-900 text-white p-2 rounded text-xs z-10">
                          <p>{formatDate(day.date)}</p>
                          <p>{formatCurrency(day.revenue)}</p>
                          <p>{day.orders} orders</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.topSellingItems.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} sold • {formatCurrency(item.revenue)} revenue
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Export Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleExportCSV} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
                <p className="text-sm text-muted-foreground">
                  Export revenue and order data for external analysis
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  Print Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handlePrintReport} variant="outline" className="w-full">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Report
                </Button>
                <p className="text-sm text-muted-foreground">
                  Generate a printable version of this report
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Share Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleShareReport} variant="outline" className="w-full">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Link
                </Button>
                <p className="text-sm text-muted-foreground">
                  Share this report with team members
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
