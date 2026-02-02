# Tenant Analytics Dashboard

This document describes the implementation of tenant analytics dashboard for Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Dashboard Components](#dashboard-components)
4. [Data Visualization](#data-visualization)
5. [Best Practices](#best-practices)

## Overview

Tenant analytics dashboard provides insights into tenant-specific metrics and performance:

- **Tenant Metrics:** Track tenant-specific metrics
- **Performance Monitoring:** Monitor tenant performance
- **Usage Analytics:** Analyze tenant usage patterns
- **Customizable:** Customize dashboard per tenant

## Features

### Dashboard Components

```typescript
// app/dashboard/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';

interface TenantMetrics {
  orders: number;
  revenue: number;
  customers: number;
  averageOrderValue: number;
  conversionRate: number;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  uptime: number;
}

interface UsageMetrics {
  apiCalls: number;
  storageUsed: number;
  bandwidthUsed: number;
  activeUsers: number;
}

export default function TenantAnalyticsDashboard() {
  const [tenantId, setTenantId] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });
  const [tenantMetrics, setTenantMetrics] = useState<TenantMetrics | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);

      const [tenant, performance, usage] = await Promise.all([
        fetchTenantMetrics(tenantId, dateRange),
        fetchPerformanceMetrics(tenantId, dateRange),
        fetchUsageMetrics(tenantId, dateRange),
      ]);

      setTenantMetrics(tenant);
      setPerformanceMetrics(performance);
      setUsageMetrics(usage);
      setLoading(false);
    }

    loadMetrics();
  }, [tenantId, dateRange]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tenant Analytics</h1>

        <div className="flex gap-4">
          <TenantSelect value={tenantId} onChange={setTenantId} />
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab tenantMetrics={tenantMetrics} />
          </TabsContent>

          <TabsContent value="performance">
            <PerformanceTab performanceMetrics={performanceMetrics} />
          </TabsContent>

          <TabsContent value="usage">
            <UsageTab usageMetrics={usageMetrics} />
          </TabsContent>

          <TabsContent value="trends">
            <TrendsTab tenantId={tenantId} dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function OverviewTab({ tenantMetrics }: { tenantMetrics: TenantMetrics | null }) {
  if (!tenantMetrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Total Orders"
        value={tenantMetrics.orders}
        format="number"
        trend="+12%"
      />
      <MetricCard
        title="Total Revenue"
        value={tenantMetrics.revenue}
        format="currency"
        trend="+8%"
      />
      <MetricCard
        title="Total Customers"
        value={tenantMetrics.customers}
        format="number"
        trend="+5%"
      />
      <MetricCard
        title="Avg Order Value"
        value={tenantMetrics.averageOrderValue}
        format="currency"
        trend="+3%"
      />
    </div>
  );
}

function PerformanceTab({ performanceMetrics }: { performanceMetrics: PerformanceMetrics | null }) {
  if (!performanceMetrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <MetricCard
        title="Avg Response Time"
        value={performanceMetrics.averageResponseTime}
        format="duration"
        trend="-5%"
      />
      <MetricCard
        title="P95 Response Time"
        value={performanceMetrics.p95ResponseTime}
        format="duration"
        trend="-8%"
      />
      <MetricCard
        title="Error Rate"
        value={performanceMetrics.errorRate}
        format="percentage"
        trend="-2%"
      />
      <MetricCard
        title="Uptime"
        value={performanceMetrics.uptime}
        format="percentage"
        trend="+0.1%"
      />
    </div>
  );
}

function UsageTab({ usageMetrics }: { usageMetrics: UsageMetrics | null }) {
  if (!usageMetrics) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="API Calls"
        value={usageMetrics.apiCalls}
        format="number"
        trend="+15%"
      />
      <MetricCard
        title="Storage Used"
        value={usageMetrics.storageUsed}
        format="bytes"
        trend="+10%"
      />
      <MetricCard
        title="Bandwidth Used"
        value={usageMetrics.bandwidthUsed}
        format="bytes"
        trend="+20%"
      />
      <MetricCard
        title="Active Users"
        value={usageMetrics.activeUsers}
        format="number"
        trend="+7%"
      />
    </div>
  );
}

function TrendsTab({ tenantId, dateRange }: { tenantId: string; dateRange: { start: Date; end: Date } }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <OrdersChart tenantId={tenantId} dateRange={dateRange} />
      <RevenueChart tenantId={tenantId} dateRange={dateRange} />
      <CustomersChart tenantId={tenantId} dateRange={dateRange} />
      <PerformanceChart tenantId={tenantId} dateRange={dateRange} />
    </div>
  );
}

function MetricCard({
  title,
  value,
  format,
  trend,
}: {
  title: string;
  value: number;
  format: 'number' | 'currency' | 'duration' | 'percentage' | 'bytes';
  trend?: string;
}) {
  const formattedValue = formatValue(value, format);
  const trendColor = trend?.startsWith('+') ? 'text-green-600' : 'text-red-600';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        {trend && (
          <div className={`text-sm ${trendColor}`}>
            {trend} from last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatValue(value: number, format: string): string {
  switch (format) {
    case 'number':
      return value.toLocaleString();
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    case 'duration':
      return `${value.toFixed(2)}ms`;
    case 'percentage':
      return `${value.toFixed(2)}%`;
    case 'bytes':
      return formatBytes(value);
    default:
      return value.toString();
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function TenantSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    async function loadTenants() {
      const response = await fetch('/api/tenants');
      const data = await response.json();
      setTenants(data);
    }

    loadTenants();
  }, []);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select tenant" />
      </SelectTrigger>
      <SelectContent>
        {tenants.map((tenant) => (
          <SelectItem key={tenant.id} value={tenant.id}>
            {tenant.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

async function fetchTenantMetrics(
  tenantId: string,
  dateRange: { start: Date; end: Date }
): Promise<TenantMetrics> {
  const response = await fetch(
    `/api/analytics/tenant/${tenantId}?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`
  );
  return response.json();
}

async function fetchPerformanceMetrics(
  tenantId: string,
  dateRange: { start: Date; end: Date }
): Promise<PerformanceMetrics> {
  const response = await fetch(
    `/api/analytics/tenant/${tenantId}/performance?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`
  );
  return response.json();
}

async function fetchUsageMetrics(
  tenantId: string,
  dateRange: { start: Date; end: Date }
): Promise<UsageMetrics> {
  const response = await fetch(
    `/api/analytics/tenant/${tenantId}/usage?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`
  );
  return response.json();
}
```

## Data Visualization

### Charts

```typescript
// components/analytics/OrdersChart.tsx
'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface OrdersChartProps {
  tenantId: string;
  dateRange: { start: Date; end: Date };
}

interface ChartData {
  date: string;
  orders: number;
}

export function OrdersChart({ tenantId, dateRange }: OrdersChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const response = await fetch(
        `/api/analytics/tenant/${tenantId}/orders?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`
      );
      const chartData = await response.json();

      setData(chartData);
      setLoading(false);
    }

    loadData();
  }, [tenantId, dateRange]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="orders" stroke="#8884d8" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

```typescript
// components/analytics/RevenueChart.tsx
'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RevenueChartProps {
  tenantId: string;
  dateRange: { start: Date; end: Date };
}

interface ChartData {
  date: string;
  revenue: number;
}

export function RevenueChart({ tenantId, dateRange }: RevenueChartProps) {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const response = await fetch(
        `/api/analytics/tenant/${tenantId}/revenue?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`
      );
      const chartData = await response.json();

      setData(chartData);
      setLoading(false);
    }

    loadData();
  }, [tenantId, dateRange]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="revenue" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

## Best Practices

### 1. Use Real-Time Updates

Use real-time updates:

```typescript
// Good: Use real-time updates
useEffect(() => {
  const interval = setInterval(async () => {
    const metrics = await fetchTenantMetrics(tenantId, dateRange);
    setTenantMetrics(metrics);
  }, 60000); // Update every minute

  return () => clearInterval(interval);
}, [tenantId, dateRange]);

// Bad: No real-time updates
useEffect(() => {
  async function loadMetrics() {
    const metrics = await fetchTenantMetrics(tenantId, dateRange);
    setTenantMetrics(metrics);
  }

  loadMetrics();
}, [tenantId, dateRange]);
```

### 2. Use Date Range Picker

Use date range picker:

```typescript
// Good: Use date range picker
<DateRangePicker value={dateRange} onChange={setDateRange} />

// Bad: No date range picker
// No date range picker
```

### 3. Use Responsive Charts

Use responsive charts:

```typescript
// Good: Use responsive charts
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={data}>
    {/* ... */}
  </LineChart>
</ResponsiveContainer>

// Bad: Fixed width charts
<LineChart data={data} width={800} height={300}>
  {/* ... */}
</LineChart>
```

### 4. Show Trends

Show trends:

```typescript
// Good: Show trends
<MetricCard
  title="Total Orders"
  value={tenantMetrics.orders}
  trend="+12%"
/>

// Bad: No trends
<MetricCard
  title="Total Orders"
  value={tenantMetrics.orders}
/>
```

### 5. Use Loading States

Use loading states:

```typescript
// Good: Use loading states
{loading ? (
  <div>Loading...</div>
) : (
  <div>{/* content */}</div>
)}

// Bad: No loading states
<div>{/* content */}</div>
```

### 6. Use Error Handling

Use error handling:

```typescript
// Good: Use error handling
try {
  const metrics = await fetchTenantMetrics(tenantId, dateRange);
  setTenantMetrics(metrics);
} catch (error) {
  console.error('Failed to fetch metrics:', error);
  setError('Failed to load metrics');
}

// Bad: No error handling
const metrics = await fetchTenantMetrics(tenantId, dateRange);
setTenantMetrics(metrics);
```

### 7. Document Dashboard

Document dashboard:

```markdown
# Good: Document dashboard
## Tenant Analytics Dashboard

### Overview Tab
- Total orders
- Total revenue
- Total customers
- Average order value

### Performance Tab
- Average response time
- P95 response time
- Error rate
- Uptime

### Usage Tab
- API calls
- Storage used
- Bandwidth used
- Active users

# Bad: No documentation
# No documentation
```

## References

- [Data Visualization](https://www.chartjs.org/)
- [Recharts](https://recharts.org/)
- [Dashboard Design](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Analytics Dashboard](https://www.mixpanel.com/blog/analytics-dashboard/)
