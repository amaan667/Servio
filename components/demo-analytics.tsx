'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TrendingUp, ShoppingBag, Users, Clock, Star, TrendingDown, Zap, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Safe dynamic imports for recharts
let ChartContainer: any = null;
let ResponsiveContainer: any = null;
let LineChart: any = null;
let BarChart: any = null;
let Bar: any = null;
let Line: any = null;
let XAxis: any = null;
let YAxis: any = null;
let CartesianGrid: any = null;
let Tooltip: any = null;

// Function to safely load recharts components
const loadRechartsComponents = async () => {
  try {
    const [
      chartModule,
      rechartsModule
    ] = await Promise.all([
      import('@/components/ui/chart'),
      import('recharts')
    ]);

    ChartContainer = chartModule.ChartContainer;
    ResponsiveContainer = rechartsModule.ResponsiveContainer;
    LineChart = rechartsModule.LineChart;
    BarChart = rechartsModule.BarChart;
    Bar = rechartsModule.Bar;
    Line = rechartsModule.Line;
    XAxis = rechartsModule.XAxis;
    YAxis = rechartsModule.YAxis;
    CartesianGrid = rechartsModule.CartesianGrid;
    Tooltip = rechartsModule.Tooltip;
  } catch (error) {
    console.error('Failed to load recharts components:', error);
  }
};

// Demo data - realistic but fake
const demoStats = {
  weeklyOrders: 278,
  weeklyRevenue: 3847.50,
  averageOrderValue: 13.84,
  topSeller: { name: 'Flat White', price: 4.25, count: 89 },
  peakHour: '11:00',
  completionRate: 94.2,
  activeTables: 8,
};

const hourlyData = [
  { name: '8:00', orders: 12, revenue: 156.50 },
  { name: '9:00', orders: 24, revenue: 312.00 },
  { name: '10:00', orders: 31, revenue: 428.75 },
  { name: '11:00', orders: 45, revenue: 623.25 }, // Peak
  { name: '12:00', orders: 38, revenue: 526.50 },
  { name: '13:00', orders: 42, revenue: 581.00 },
  { name: '14:00', orders: 28, revenue: 387.20 },
  { name: '15:00', orders: 19, revenue: 262.75 },
  { name: '16:00', orders: 15, revenue: 207.50 },
  { name: '17:00', orders: 14, revenue: 193.50 },
  { name: '18:00', orders: 10, revenue: 138.50 },
];

const topItems = [
  { name: 'Flat White', quantity: 89, revenue: 378.25 },
  { name: 'Cappuccino', quantity: 76, revenue: 266.00 },
  { name: 'Avocado Toast', quantity: 54, revenue: 351.00 },
  { name: 'Latte', quantity: 68, revenue: 272.00 },
  { name: 'Croissant', quantity: 45, revenue: 112.50 },
];

const weeklyTrend = [
  { name: 'Mon', orders: 42, revenue: 581.50 },
  { name: 'Tue', orders: 38, revenue: 526.00 },
  { name: 'Wed', orders: 45, revenue: 623.25 },
  { name: 'Thu', orders: 41, revenue: 567.75 },
  { name: 'Fri', orders: 52, revenue: 719.00 },
  { name: 'Sat', orders: 48, revenue: 664.50 },
  { name: 'Sun', orders: 12, revenue: 165.50 },
];

const aiInsights = [
  {
    type: 'success',
    icon: TrendingUp,
    title: 'Strong Performance',
    message: 'Flat White sales are up 23% this week compared to last week',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  {
    type: 'warning',
    icon: AlertTriangle,
    title: 'Possible Optimization',
    message: 'Avocado Toast may be underperforming at £6.50 — consider a price adjustment to £6.95 based on competitor analysis',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    type: 'info',
    icon: Zap,
    title: 'Peak Time Insight',
    message: '11:00 AM is your busiest hour — consider staffing up during this time',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    type: 'suggestion',
    icon: Star,
    title: 'Menu Recommendation',
    message: 'Consider adding more cold drinks — they typically sell well during afternoon hours',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
];

export default function DemoAnalytics() {
  console.log('[DEMO DEBUG] DemoAnalytics component rendering', {
    timestamp: new Date().toISOString(),
  });

  const [chartsLoaded, setChartsLoaded] = useState(false);
  const [chartsError, setChartsError] = useState(false);

  useEffect(() => {
    loadRechartsComponents()
      .then(() => setChartsLoaded(true))
      .catch(() => setChartsError(true));
  }, []);

  const StatCard = ({ title, value, icon: Icon, subtitle, trend }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-gray-800" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
        {trend && (
          <div className={`flex items-center text-xs mt-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {Math.abs(trend)}% vs last week
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (chartsError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
            <p className="text-gray-600">Demo data showing this week's performance</p>
          </div>
          <Badge className="bg-purple-100 text-purple-800 border-purple-300">
            Demo Mode
          </Badge>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Charts Temporarily Unavailable</CardTitle>
            <CardDescription>Interactive charts are loading...</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Please refresh the page to try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600">Demo data showing this week's performance</p>
        </div>
        <Badge className="bg-purple-100 text-purple-800 border-purple-300">
          Demo Mode
        </Badge>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Weekly Revenue"
          value={`£${demoStats.weeklyRevenue.toFixed(2)}`}
          icon={TrendingUp}
          trend={12.5}
        />
        <StatCard
          title="Weekly Orders"
          value={demoStats.weeklyOrders}
          icon={ShoppingBag}
          trend={8.3}
        />
        <StatCard
          title="Avg Order Value"
          value={`£${demoStats.averageOrderValue.toFixed(2)}`}
          icon={Star}
          trend={4.2}
        />
        <StatCard
          title="Active Tables"
          value={demoStats.activeTables}
          icon={Users}
          subtitle="Currently occupied"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Hourly Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Hourly Activity</CardTitle>
            <CardDescription>Orders and revenue by hour</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoaded && ChartContainer && ResponsiveContainer ? (
              <ChartContainer config={{
                orders: { color: '#8b5cf6' },
                revenue: { color: '#10b981' }
              }}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="orders" fill="#8b5cf6" name="Orders" />
                    <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue (£)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">Loading chart...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Revenue Trend</CardTitle>
            <CardDescription>Last 7 days performance</CardDescription>
          </CardHeader>
          <CardContent>
            {chartsLoaded && ChartContainer && ResponsiveContainer ? (
              <ChartContainer config={{
                revenue: { color: '#10b981' }
              }}>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">Loading chart...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Items */}
      <Card>
        <CardHeader>
          <CardTitle>Top Selling Items This Week</CardTitle>
          <CardDescription>Performance by item</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] md:h-[350px]">
            {chartsLoaded && ChartContainer && ResponsiveContainer ? (
              <ChartContainer config={{
                qty: { color: '#8b5cf6' },
                revenue: { color: '#10b981' }
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems} layout="vertical" margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#8b5cf6" name="Quantity" />
                    <Bar dataKey="revenue" fill="#10b981" name="Revenue (£)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">Loading chart...</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Insights */}
      <Card className="border-2 border-purple-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Zap className="w-5 h-5 mr-2 text-purple-600" />
                AI-Powered Insights
              </CardTitle>
              <CardDescription>Smart suggestions based on your data</CardDescription>
            </div>
            <Badge className="bg-gradient-to-r from-purple-600 to-purple-800 text-white border-0">
              🤖 AI
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {aiInsights.map((insight, index) => (
              <div
                key={index}
                className={`border-2 ${insight.borderColor} ${insight.bgColor} rounded-lg p-4`}
              >
                <div className="flex items-start space-x-3">
                  <insight.icon className={`w-5 h-5 mt-0.5 ${insight.color}`} />
                  <div className="flex-1">
                    <h4 className={`font-semibold ${insight.color}`}>{insight.title}</h4>
                    <p className="text-sm text-gray-700 mt-1">{insight.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong className="text-purple-900">💡 Pro Tip:</strong> Servio's AI continuously analyzes your 
              sales patterns, menu performance, and customer behavior to provide actionable insights that 
              help you optimize pricing, inventory, and staffing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}