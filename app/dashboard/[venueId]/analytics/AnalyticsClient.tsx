"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Star,
  BarChart3,
  PieChart,
} from "lucide-react";

interface AnalyticsClientProps {
  venueId: string;
  ordersData: any;
  menuData: any;
  feedbackData: any;
  revenueData: any;
}

export function AnalyticsClient({
  venueId: _venueId,
  ordersData,
  menuData,
  feedbackData,
  revenueData,
}: AnalyticsClientProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Track your business performance and insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={`£${revenueData.totalRevenue.toFixed(2)}`}
          subtitle="Last 30 days"
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
          trend={+12.5}
        />
        <MetricCard
          title="Total Orders"
          value={ordersData.totalOrders.toString()}
          subtitle="Last 30 days"
          icon={<ShoppingBag className="h-4 w-4 text-blue-600" />}
          trend={+8.3}
        />
        <MetricCard
          title="Avg Order Value"
          value={`£${ordersData.avgOrderValue.toFixed(2)}`}
          subtitle="Per order"
          icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
          trend={+5.2}
        />
        <MetricCard
          title="Customer Rating"
          value={feedbackData.avgOverallRating.toFixed(1)}
          subtitle="Out of 5 stars"
          icon={<Star className="h-4 w-4 text-yellow-600" />}
          trend={+0.3}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="menu">Menu Performance</TabsTrigger>
          <TabsTrigger value="feedback">Customer Feedback</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Revenue Trend
                </CardTitle>
                <CardDescription>Daily revenue over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(revenueData.revenueByDay)
                    .slice(-7)
                    .map(([date, revenue]) => (
                      <div key={date} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{date}</span>
                        <span className="font-semibold">£{(revenue as number).toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Orders by Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Order Status Distribution
                </CardTitle>
                <CardDescription>Current order breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(ordersData.ordersByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`}></div>
                        <span className="text-sm font-medium capitalize">
                          {status.replace("_", " ")}
                        </span>
                      </div>
                      <span className="font-semibold">{count as number}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="menu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Items</CardTitle>
              <CardDescription>Most popular menu items by order count</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {menuData.topSellingItems.map((item: any, index: number) => (
                  <div key={item.id} className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{item.ordersCount} orders</p>
                      <p className="text-sm text-muted-foreground">£{item.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Total Menu Items"
              value={menuData.totalItems.toString()}
              subtitle="Active items"
              icon={<ShoppingBag className="h-4 w-4" />}
            />
            <MetricCard
              title="Items with Images"
              value={menuData.itemsWithImages.toString()}
              subtitle={`${Math.round((menuData.itemsWithImages / menuData.totalItems) * 100)}% coverage`}
              icon={<Users className="h-4 w-4" />}
            />
            <MetricCard
              title="Categories"
              value={Object.keys(menuData.itemsByCategory).length.toString()}
              subtitle="Menu sections"
              icon={<PieChart className="h-4 w-4" />}
            />
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              title="Overall Rating"
              value={feedbackData.avgOverallRating.toFixed(1)}
              subtitle="Out of 5 stars"
              icon={<Star className="h-4 w-4 text-yellow-600" />}
            />
            <MetricCard
              title="Food Quality"
              value={feedbackData.avgFoodQuality.toFixed(1)}
              subtitle="Average rating"
              icon={<Star className="h-4 w-4 text-orange-600" />}
            />
            <MetricCard
              title="Service Quality"
              value={feedbackData.avgServiceQuality.toFixed(1)}
              subtitle="Average rating"
              icon={<Star className="h-4 w-4 text-blue-600" />}
            />
            <MetricCard
              title="Value Rating"
              value={feedbackData.avgValueRating.toFixed(1)}
              subtitle="Average rating"
              icon={<Star className="h-4 w-4 text-green-600" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Feedback</CardTitle>
              <CardDescription>Latest customer reviews</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {feedbackData.recentFeedback.map((feedback: any) => (
                  <div key={feedback.id} className="border-b pb-4 last:border-0">
                    <div className="flex items-center gap-2 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < feedback.overall_rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                      <span className="text-sm text-muted-foreground">
                        {new Date(feedback.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Track your business metrics over time</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Trend analysis coming soon with historical comparisons and predictions
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {subtitle}
          {trend !== undefined && (
            <span className={`flex items-center ${trend > 0 ? "text-green-600" : "text-red-600"}`}>
              {trend > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(trend)}%
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    placed: "bg-yellow-500",
    in_prep: "bg-blue-500",
    ready: "bg-green-500",
    serving: "bg-purple-500",
    completed: "bg-gray-500",
    cancelled: "bg-red-500",
  };
  return colors[status.toLowerCase()] || "bg-gray-400";
}
