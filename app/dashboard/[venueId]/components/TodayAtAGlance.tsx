"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign } from "lucide-react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface TodayAtAGlanceProps {
  ordersByHour: Array<{ hour: string; orders: number }>;
  tableUtilization: number;
  revenueByCategory: Array<{ name: string; value: number; color: string }>;
  loading?: boolean;
}

export function TodayAtAGlance({
  ordersByHour,
  tableUtilization: _tableUtilization,
  revenueByCategory,
  loading = false,
}: TodayAtAGlanceProps) {
  const COLORS = ["#5B21B6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

  // Log what this component receives so we can debug data flow
  try {
    console.log("🔍 [TODAY AT A GLANCE] Props received:", {
      ordersByHour,
      revenueByCategory,
      loading,
      revenueByCategoryType: typeof revenueByCategory,
      isRevenueArray: Array.isArray(revenueByCategory),
      revenueLength: Array.isArray(revenueByCategory) ? revenueByCategory.length : "N/A",
    });
  } catch {
    // Swallow logging errors to avoid impacting UI
  }

  // Never show loading state - render immediately with data
  const isLoading = false;

  // Custom tooltip for orders by hour
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { hour: string }; value: number }>;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {payload[0].payload.hour}
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            {payload[0].value} {payload[0].value === 1 ? "order" : "orders"}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for revenue by category
  const CategoryTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number }>;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{payload[0].name}</p>
          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
            £{payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Today at a Glance</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Hour */}
        <Card className="border-2 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-950/20 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Orders by Hour
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-pulse text-sm text-gray-500 dark:text-gray-400">
                    Loading...
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ordersByHour}>
                    <defs>
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="orders"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorOrders)"
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table Utilization - Removed (can't calculate without max capacity) */}

        {/* Revenue by Category */}
        <Card className="border-2 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-green-50/30 dark:from-gray-800 dark:to-green-950/20 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
              Revenue by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-pulse text-sm text-gray-500 dark:text-gray-400">
                    Loading...
                  </div>
                </div>
              ) : !revenueByCategory || revenueByCategory.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No revenue data yet
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                      animationDuration={1000}
                    >
                      {revenueByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CategoryTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
