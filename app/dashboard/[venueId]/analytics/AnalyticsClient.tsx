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

interface OrdersData {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  avgOrderValue: number;
  ordersByStatus: Record<string, number>;
  ordersByDay?: Record<string, number>;
}

interface MenuData {
  totalItems: number;
  activeItems: number;
  topSellingItems: TopSellingItem[];
  itemsWithImages: number;
  itemsByCategory: Record<string, number>;
}

interface RevenueData {
  totalRevenue: number;
  averageOrderValue: number;
  revenueByHour: unknown[];
  revenueByDay: Record<string, number>;
}

interface TrendsData {
  revenue: number;
  orders: number;
  aov: number;
}

interface PeriodComparisonData {
  thisWeek: number;
  lastWeek: number;
  change: number;
}

interface AnalyticsClientProps {
  ordersData: OrdersData;
  menuData: MenuData;
  revenueData: RevenueData;
  trends: TrendsData;
  periodComparison: PeriodComparisonData;
  hasAdvancedAnalytics?: boolean;
  currentTier?: string;
  venueId: string;
}

export default function AnalyticsClient({
  ordersData,
  menuData,
  revenueData,
  trends,
  periodComparison,
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
          trend={trends.revenue}
        />
        <MetricCard
          title="Total Orders"
          value={ordersData.totalOrders.toString()}
          subtitle="Last 30 days"
          icon={<ShoppingBag className="h-4 w-4 text-blue-600" />}
          trend={trends.orders}
        />
        <MetricCard
          title="Avg Order Value"
          value={`£${ordersData.avgOrderValue.toFixed(2)}`}
          subtitle="Per order"
          icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
          trend={trends.aov}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="menu">
            <span className="sm:hidden">Menu</span>
            <span className="hidden sm:inline">Menu Performance</span>
          </TabsTrigger>
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
              subtitle={`${menuData.totalItems > 0 ? Math.round((menuData.itemsWithImages / menuData.totalItems) * 100) : 0}% coverage`}
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
                        £{periodComparison.thisWeek.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Last Week</p>
                      <p className="text-2xl font-bold text-gray-600">
                        £{periodComparison.lastWeek.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {periodComparison.change >= 0 ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span
                          className={`font-semibold ${periodComparison.change >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          +{Math.round(periodComparison.change)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <span className="font-semibold text-red-600">
                          {Math.round(periodComparison.change)}%
                        </span>
                      </>
                    )}
                    <span className="text-muted-foreground">vs last week</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Growth Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Growth Trends</CardTitle>
                <CardDescription>Weekly growth patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Orders</span>
                    <div className="flex items-center gap-2">
                      {trends.orders >= 0 ? (
                        <>
                          <TrendingUp className="h-3 w-3 text-green-600" />
                          <span className="text-sm font-semibold text-green-600">
                            +{Math.round(trends.orders)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-3 w-3 text-red-600" />
                          <span className="text-sm font-semibold text-red-600">
                            {Math.round(trends.orders)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Revenue</span>
                    <div className="flex items-center gap-2">
                      {trends.revenue >= 0 ? (
                        <>
                          <TrendingUp className="h-3 w-3 text-green-600" />
                          <span className="text-sm font-semibold text-green-600">
                            +{Math.round(trends.revenue)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-3 w-3 text-red-600" />
                          <span className="text-sm font-semibold text-red-600">
                            {Math.round(trends.revenue)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg Order Value</span>
                    <div className="flex items-center gap-2">
                      {trends.aov >= 0 ? (
                        <>
                          <TrendingUp className="h-3 w-3 text-green-600" />
                          <span className="text-sm font-semibold text-green-600">
                            +{Math.round(trends.aov)}%
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-3 w-3 text-red-600" />
                          <span className="text-sm font-semibold text-red-600">
                            {Math.round(trends.aov)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">New Customers</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">N/A</span>
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
                <p className="text-muted-foreground text-sm py-4">No hourly data available</p>
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
                  {ordersData.ordersByDay && Object.keys(ordersData.ordersByDay).length > 0 ? (
                    Object.entries(ordersData.ordersByDay)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 7)
                      .map(([day, orders]) => {
                        const maxOrders = Math.max(...Object.values(ordersData.ordersByDay || {}));
                        const percentage =
                          maxOrders > 0 ? Math.round((orders / maxOrders) * 100) : 0;
                        return (
                          <div key={day} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="capitalize">{day}</span>
                              <span className="font-semibold">{orders} avg</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-purple-600 h-2 rounded-full"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <p className="text-muted-foreground text-sm">No data available</p>
                  )}
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
              {Math.abs(Math.round(trend))}%
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
