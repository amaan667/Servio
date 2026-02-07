/**
 * Revenue Chart Component
 * Displays revenue trends over time using Recharts
 */

"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    orders: number;
    averageOrderValue: number;
  }>;
  title?: string;
  showOrders?: boolean;
  showAverageOrderValue?: boolean;
  height?: number;
  loading?: boolean;
}

export function RevenueChart({
  data,
  title = "Revenue Overview",
  showOrders = false,
  showAverageOrderValue = false,
  height = 300,
  loading = false,
}: RevenueChartProps) {
  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return `$${value.toFixed(0)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-[300px] bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#888888"
              fontSize={12}
            />
            <YAxis
              yAxisId="revenue"
              tickFormatter={formatCurrency}
              stroke="#888888"
              fontSize={12}
            />
            {showOrders && (
              <YAxis
                yAxisId="orders"
                orientation="right"
                stroke="#82ca9d"
                fontSize={12}
              />
            )}
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg">
                      <p className="font-medium">{formatDate(label)}</p>
                      {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }} className="text-sm">
                          {entry.dataKey === "revenue"
                            ? `Revenue: ${formatCurrency(Number(entry.value) || 0)}`
                            : entry.dataKey === "orders"
                            ? `Orders: ${entry.value}`
                            : `AOV: ${formatCurrency(Number(entry.value) || 0)}`}
                        </p>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              stroke="#8884d8"
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name="Revenue"
            />
            {showOrders && (
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                stroke="#82ca9d"
                name="Orders"
                dot={false}
              />
            )}
            {showAverageOrderValue && (
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="averageOrderValue"
                stroke="#ffc658"
                name="Avg Order Value"
                dot={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Simple line chart for quick revenue display
 */
export function SimpleRevenueChart({
  data,
  height = 200,
}: {
  data: Array<{ date: string; revenue: number }>;
  height?: number;
}) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis dataKey="date" tickFormatter={formatDate} stroke="#888888" fontSize={10} />
        <YAxis stroke="#888888" fontSize={10} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-white p-2 border rounded shadow text-sm">
                  <p>{formatDate(label)}</p>
                  <p className="font-medium">${Number(payload[0]?.value || 0).toFixed(2)}</p>
                </div>
              );
            }
            return null;
          }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#8884d8"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
