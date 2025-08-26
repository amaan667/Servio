"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { supabase } from "@/lib/supabase";
import { ArrowLeft, BarChart, TrendingUp, Clock, ShoppingBag } from "lucide-react";

export default function AnalyticsClient({ venueId, venueName }: { venueId: string; venueName: string }) {
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkForData = async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('venue_id', venueId)
        .limit(1);

  setHasData(Array.isArray(orders) && orders.length > 0);
      setLoading(false);
    };

    checkForData();
  }, [venueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-lg text-muted-foreground">Business insights and performance metrics</p>
      </div>

        {!hasData ? (
          <Card>
            <CardContent className="p-12 text-center">
              <BarChart className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Analytics Data Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Analytics will appear here once you start receiving orders. 
                Generate QR codes and start taking orders to see your business insights.
              </p>
              <div className="flex justify-center space-x-4">
                <Button asChild>
                  <Link href={`/dashboard/${venueId}/qr-codes`}>Generate QR Codes</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/dashboard/${venueId}/live-orders`}>View Live Orders</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
                      <p className="text-2xl font-bold text-foreground">0</p>
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
                      <p className="text-2xl font-bold text-foreground">£0.00</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Average Order</p>
                      <p className="text-2xl font-bold text-foreground">£0.00</p>
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
                      <p className="text-2xl font-bold text-foreground">0</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Over Time</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <BarChart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">Chart will appear here</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Selling Items</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">Chart will appear here</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
    </div>
  );
}
