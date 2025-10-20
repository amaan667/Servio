"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, DollarSign } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface TodayAtAGlanceProps {
  ordersByHour: Array<{ hour: string; orders: number }>;
  tableUtilization: number;
  revenueByCategory: Array<{ name: string; value: number; color: string }>;
  loading?: boolean;
}

export function TodayAtAGlance({ ordersByHour, tableUtilization, revenueByCategory, loading }: TodayAtAGlanceProps) {
  const COLORS = ['#5B21B6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  // Custom tooltip for orders by hour
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-900">
            {payload[0].payload.hour}
          </p>
          <p className="text-sm text-blue-600">
            {payload[0].value} {payload[0].value === 1 ? 'order' : 'orders'}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for revenue by category
  const CategoryTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-900">
            {payload[0].name}
          </p>
          <p className="text-sm text-green-600 font-medium">
            £{payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">Today at a Glance</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Orders by Hour */}
        <Card className="border-2 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Orders by Hour
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-pulse text-sm text-gray-500">Loading...</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ordersByHour}>
                    <defs>
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fontSize: 11, fill: '#6b7280' }}
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

        {/* Table Utilization */}
        <Card className="border-2 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-purple-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              Table Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex flex-col items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="10"
                    strokeDasharray={`${tableUtilization * 2.827} 282.7`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">{tableUtilization}%</div>
                    <div className="text-xs text-gray-500">in use</div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-4 text-center">
                {tableUtilization < 30 && 'Low occupancy - consider promotions'}
                {tableUtilization >= 30 && tableUtilization < 70 && 'Good utilization'}
                {tableUtilization >= 70 && 'High occupancy - great job!'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Category */}
        <Card className="border-2 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-green-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Revenue by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-pulse text-sm text-gray-500">Loading...</div>
                </div>
              ) : revenueByCategory.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-gray-500">No revenue data yet</p>
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
