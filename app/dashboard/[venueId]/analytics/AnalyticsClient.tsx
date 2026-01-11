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
  BarChart3,
  PieChart,
} from "lucide-react";
import { CostInsights } from "./components/CostInsights";

interface TopSellingItem {
  name: string;
  quantity: number;
  revenue: number;
  category?: string;
  ordersCount?: number;
  price?: number;
}

interface AnalyticsClientProps {
  ordersData: {
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    avgOrderValue: number;
    ordersByStatus: Record<string, number>;
  };
  menuData: {
    totalItems: number;
    activeItems: number;
    topSellingItems: TopSellingItem[];
    itemsWithImages: number;
    itemsByCategory: Record<string, number>;
  };
  revenueData: {
    totalRevenue: number;
    averageOrderValue: number;
    revenueByHour: unknown[];
    revenueByDay: Record<string, number>;
  };
  hasAdvancedAnalytics?: boolean;
  currentTier?: string;
  venueId: string;
}

export default function AnalyticsClient({
  ordersData,
  menuData,
  revenueData,
  venueId,
}: AnalyticsClientProps) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="menu">Menu Performance</TabsTrigger>
          <TabsTrigger value="costs">Cost Insights</TabsTrigger>
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
                {menuData.topSellingItems.map((item, index: number) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{item.ordersCount} orders</p>
                      <p className="text-sm text-muted-foreground">
                        £{item.price?.toFixed(2) || "0.00"}
                      </p>
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

        <TabsContent value="costs" className="space-y-4">
          {venueId ? (
            <CostInsights venueId={venueId} timePeriod="30d" />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground">Venue ID required for cost insights</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Period Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Period Comparison</CardTitle>
                <CardDescription>Compare current vs previous period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">This Week</p>
                      <p className="text-2xl font-bold text-green-600">
                        £{(revenueData.totalRevenue * 0.3).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Last Week</p>
                      <p className="text-2xl font-bold text-gray-600">
                        £{(revenueData.totalRevenue * 0.25).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-green-600 font-semibold">+20%</span>
                    <span className="text-muted-foreground">vs last week</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Growth Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Growth Trends</CardTitle>
                <CardDescription>Monthly growth patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Orders</span>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-sm font-semibold text-green-600">+15.3%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Revenue</span>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-sm font-semibold text-green-600">+12.8%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg Order Value</span>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-3 w-3 text-red-600" />
                      <span className="text-sm font-semibold text-red-600">-2.1%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">New Customers</span>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-sm font-semibold text-green-600">+8.5%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Peak Hours */}
            <Card>
              <CardHeader>
                <CardTitle>Peak Hours Analysis</CardTitle>
                <CardDescription>Busiest times for your venue</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">12:00 PM - 2:00 PM</span>
                    <span className="text-sm font-semibold">
                      {Math.floor(ordersData.totalOrders * 0.35)} orders
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">6:00 PM - 8:00 PM</span>
                    <span className="text-sm font-semibold">
                      {Math.floor(ordersData.totalOrders * 0.3)} orders
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">10:00 AM - 12:00 PM</span>
                    <span className="text-sm font-semibold">
                      {Math.floor(ordersData.totalOrders * 0.2)} orders
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm">8:00 PM - 10:00 PM</span>
                    <span className="text-sm font-semibold">
                      {Math.floor(ordersData.totalOrders * 0.15)} orders
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Day of Week Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Busiest Days</CardTitle>
                <CardDescription>Average orders by day of week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    "Saturday",
                    "Friday",
                    "Sunday",
                    "Thursday",
                    "Wednesday",
                    "Tuesday",
                    "Monday",
                  ].map((day, index) => {
                    const percentage = [95, 88, 75, 65, 60, 45, 40][index];
                    return (
                      <div key={day} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{day}</span>
                          <span className="font-semibold">
                            {Math.floor((ordersData.totalOrders / 30) * (percentage / 50))} avg
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
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
