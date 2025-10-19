"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart, TrendingUp, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";


interface Props {
  venueId: string;
  venueName: string;
}

export default function AnalyticsClientSimple({ venueId, venueName }: Props) {
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    menuItemsCount: 0
  });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);
        const supabase = createClient();
        
        // Get basic analytics data
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('total_amount, created_at')
          .eq('venue_id', venueId)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        if (ordersError) {
          console.error('[ANALYTICS] Error loading orders:', ordersError);
          setError('Failed to load analytics data');
          return;
        }

        const { data: menuItems, error: menuError } = await supabase
          .from('menu_items')
          .select('id')
          .eq('venue_id', venueId)
          .eq('is_available', true);

        if (menuError) {
          console.error('[ANALYTICS] Error loading menu items:', menuError);
        }

        const totalRevenue = orders?.reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0) || 0;
        const totalOrders = orders?.length || 0;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        setAnalyticsData({
          totalOrders,
          totalRevenue,
          averageOrderValue,
          menuItemsCount: menuItems?.length || 0
        });
      } catch (err) {
        console.error('[ANALYTICS] Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [venueId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Analytics</h2>
          <p className="text-gray-700">Preparing your analytics dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <BarChart className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Analytics</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Analytics Dashboard
          </h1>
          <p className="text-lg text-foreground mt-2">
            Performance insights for {venueName}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.totalOrders}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{analyticsData.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Order</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">£{analyticsData.averageOrderValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Per order</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Menu Items</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analyticsData.menuItemsCount}</div>
              <p className="text-xs text-muted-foreground">Available items</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Analytics Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Venue ID: {venueId}
              </p>
              <p className="text-sm text-gray-600">
                Data period: Last 30 days
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
