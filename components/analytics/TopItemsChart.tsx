/**
 * Top Items Chart Component
 * Displays top selling items as a bar chart
 */

"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TopItemsChartProps {
  data: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  title?: string;
  metric?: "quantity" | "revenue";
  height?: number;
  loading?: boolean;
  maxItems?: number;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export function TopItemsChart({
  data,
  title = "Top Selling Items",
  metric = "quantity",
  height = 300,
  loading = false,
  maxItems = 5,
}: TopItemsChartProps) {
  // Sort and limit data
  const sortedData = React.useMemo(() => {
    const sorted = [...(data || [])].sort((a, b) => {
      return metric === "quantity" ? b.quantity - a.quantity : b.revenue - a.revenue;
    });
    return sorted.slice(0, maxItems);
  }, [data, metric, maxItems]);

  // Format revenue for display
  const formatRevenue = (value: number) => {
    return `$${value.toFixed(2)}`;
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

  if (!sortedData || sortedData.length === 0) {
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
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              type="number"
              tickFormatter={metric === "revenue" ? formatRevenue : undefined}
              stroke="#888888"
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              stroke="#888888"
              fontSize={12}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const itemData = payload[0]?.payload;
                  if (!itemData) return null;
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg">
                      <p className="font-medium">{itemData.name}</p>
                      <p className="text-sm">Quantity: {itemData.quantity}</p>
                      <p className="text-sm">Revenue: {formatRevenue(itemData.revenue)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey={metric} name={metric === "quantity" ? "Quantity Sold" : "Revenue"} radius={[0, 4, 4, 0]}>
              {sortedData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Simple horizontal bar chart for quick display
 */
export function SimpleTopItems({
  data,
  metric = "revenue",
  height = 200,
}: {
  data: Array<{ name: string; quantity: number; revenue: number }>;
  metric?: "quantity" | "revenue";
  height?: number;
}) {
  const sortedData = [...(data || [])]
    .sort((a, b) => {
      return metric === "quantity" ? b.quantity - a.quantity : b.revenue - a.revenue;
    })
    .slice(0, 5);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sortedData} layout="vertical">
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const itemData = payload[0]?.payload;
              if (!itemData) return null;
              return (
                <div className="bg-white p-2 border rounded shadow text-sm">
                  <p className="font-medium">{itemData.name}</p>
                  <p>{metric === "revenue" ? `$${itemData.revenue.toFixed(2)}` : itemData.quantity}</p>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey={metric} fill="#8884d8" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
