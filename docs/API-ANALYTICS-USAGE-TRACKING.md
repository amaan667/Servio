# API Analytics and Usage Tracking

This document describes the implementation of API analytics and usage tracking for Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Configuration](#configuration)
4. [Implementation](#implementation)
5. [Dashboard](#dashboard)
6. [Best Practices](#best-practices)

## Overview

API analytics and usage tracking provides insights into API usage, performance, and errors:

- **Usage Tracking:** Track API usage across all endpoints
- **Performance Monitoring:** Monitor API performance metrics
- **Error Tracking:** Track API errors and failures
- **Analytics Dashboard:** Visualize API analytics

## Features

### Configuration

```typescript
// lib/analytics/config.ts
export interface AnalyticsConfig {
  enabled: boolean;
  sampleRate: number; // 0-1
  trackErrors: boolean;
  trackPerformance: boolean;
  trackUsage: boolean;
  retentionDays: number;
}

export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  enabled: true,
  sampleRate: 1.0, // 100% sampling
  trackErrors: true,
  trackPerformance: true,
  trackUsage: true,
  retentionDays: 90,
};
```

### Analytics Service

```typescript
// lib/analytics/AnalyticsService.ts
import { AnalyticsConfig } from './config';

export interface ApiEvent {
  id: string;
  timestamp: Date;
  tenantId?: string;
  userId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  error?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface UsageMetrics {
  tenantId: string;
  endpoint: string;
  method: string;
  count: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
}

export class AnalyticsService {
  private config: AnalyticsConfig;
  private events: ApiEvent[] = [];

  constructor(config: AnalyticsConfig = DEFAULT_ANALYTICS_CONFIG) {
    this.config = config;
  }

  async trackEvent(event: ApiEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Sample events
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    // Add event to buffer
    this.events.push(event);

    // Flush events if buffer is full
    if (this.events.length >= 100) {
      await this.flushEvents();
    }
  }

  async trackRequest(
    tenantId: string | undefined,
    userId: string | undefined,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    error?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    const event: ApiEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      tenantId,
      userId,
      endpoint,
      method,
      statusCode,
      duration,
      error,
      userAgent,
      ipAddress,
    };

    await this.trackEvent(event);
  }

  async flushEvents(): Promise<void> {
    if (this.events.length === 0) {
      return;
    }

    const events = [...this.events];
    this.events = [];

    // Store events in database
    await this.storeEvents(events);

    console.log(`Flushed ${events.length} analytics events`);
  }

  private async storeEvents(events: ApiEvent[]): Promise<void> {
    // Store events in database
    // This is a placeholder - implement based on your database
    console.log('Storing events:', events);
  }

  async getUsageMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageMetrics[]> {
    // Get usage metrics from database
    // This is a placeholder - implement based on your database
    return [];
  }

  async getErrorMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ErrorMetrics[]> {
    // Get error metrics from database
    // This is a placeholder - implement based on your database
    return [];
  }

  async getPerformanceMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PerformanceMetrics[]> {
    // Get performance metrics from database
    // This is a placeholder - implement based on your database
    return [];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface ErrorMetrics {
  endpoint: string;
  method: string;
  error: string;
  count: number;
  lastOccurrence: Date;
}

interface PerformanceMetrics {
  endpoint: string;
  method: string;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
}

// Singleton instance
let analyticsService: AnalyticsService | null = null;

export function getAnalyticsService(): AnalyticsService {
  if (!analyticsService) {
    analyticsService = new AnalyticsService();
  }

  return analyticsService;
}
```

## Implementation

### Middleware

```typescript
// lib/middleware/analytics.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAnalyticsService } from '../analytics/AnalyticsService';

export async function withAnalytics(
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const request = handler.request;

  // Get tenant ID and user ID
  const tenantId = await getTenantId(request);
  const userId = await getUserId(request);

  // Get endpoint and method
  const url = new URL(request.url);
  const endpoint = url.pathname;
  const method = request.method;

  // Get user agent and IP address
  const userAgent = request.headers.get('User-Agent') || undefined;
  const ipAddress = request.headers.get('X-Forwarded-For')?.split(',')[0] || request.headers.get('X-Real-IP') || undefined;

  // Track request
  const startTime = Date.now();

  try {
    const response = await handler(request);

    const duration = Date.now() - startTime;

    // Track successful request
    await getAnalyticsService().trackRequest(
      tenantId,
      userId,
      endpoint,
      method,
      response.status,
      duration,
      undefined,
      userAgent,
      ipAddress
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Track failed request
    await getAnalyticsService().trackRequest(
      tenantId,
      userId,
      endpoint,
      method,
      500,
      duration,
      error.message,
      userAgent,
      ipAddress
    );

    throw error;
  }
}

async function getTenantId(request: NextRequest): Promise<string | undefined> {
  // Get tenant ID from header
  const tenantId = request.headers.get('X-Tenant-ID');

  if (tenantId) {
    return tenantId;
  }

  // Get tenant ID from JWT token
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (token) {
    const decoded = await decodeJWT(token);
    return decoded.tenantId;
  }

  return undefined;
}

async function getUserId(request: NextRequest): Promise<string | undefined> {
  // Get user ID from JWT token
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (token) {
    const decoded = await decodeJWT(token);
    return decoded.userId;
  }

  return undefined;
}

async function decodeJWT(token: string): Promise<any> {
  // Decode JWT token
  const jwt = require('jsonwebtoken');
  return jwt.verify(token, process.env.JWT_SECRET!);
}
```

### API Route Example

```typescript
// app/api/v1/venues/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAnalytics } from '@/lib/middleware/analytics';
import { VenueService } from '@/services/VenueService';

const venueService = new VenueService();

export async function GET(request: NextRequest) {
  const venues = await venueService.findAll();
  return NextResponse.json(venues);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const venue = await venueService.create(data);
  return NextResponse.json(venue);
}

// Wrap handlers with analytics
export const GET = withAnalytics(GET);
export const POST = withAnalytics(POST);
```

## Dashboard

### Analytics Dashboard

```typescript
// app/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { UsageMetrics, ErrorMetrics, PerformanceMetrics } from '@/lib/analytics/AnalyticsService';

export default function AnalyticsDashboard() {
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics[]>([]);
  const [errorMetrics, setErrorMetrics] = useState<ErrorMetrics[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);

      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const endDate = new Date();

      const [usage, errors, performance] = await Promise.all([
        fetchUsageMetrics(startDate, endDate),
        fetchErrorMetrics(startDate, endDate),
        fetchPerformanceMetrics(startDate, endDate),
      ]);

      setUsageMetrics(usage);
      setErrorMetrics(errors);
      setPerformanceMetrics(performance);
      setLoading(false);
    }

    loadMetrics();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">API Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <UsageCard metrics={usageMetrics} />
        <ErrorCard metrics={errorMetrics} />
        <PerformanceCard metrics={performanceMetrics} />
      </div>
    </div>
  );
}

function UsageCard({ metrics }: { metrics: UsageMetrics[] }) {
  const totalRequests = metrics.reduce((sum, m) => sum + m.count, 0);
  const successRate = metrics.reduce((sum, m) => sum + m.successCount, 0) / totalRequests * 100;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Usage Metrics</h2>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Total Requests:</span>
          <span className="font-semibold">{totalRequests.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Success Rate:</span>
          <span className="font-semibold">{successRate.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ metrics }: { metrics: ErrorMetrics[] }) {
  const totalErrors = metrics.reduce((sum, m) => sum + m.count, 0);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Error Metrics</h2>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Total Errors:</span>
          <span className="font-semibold">{totalErrors.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function PerformanceCard({ metrics }: { metrics: PerformanceMetrics[] }) {
  const avgDuration = metrics.reduce((sum, m) => sum + m.avgDuration, 0) / metrics.length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Avg Duration:</span>
          <span className="font-semibold">{avgDuration.toFixed(2)}ms</span>
        </div>
      </div>
    </div>
  );
}

async function fetchUsageMetrics(startDate: Date, endDate: Date): Promise<UsageMetrics[]> {
  const response = await fetch(`/api/analytics/usage?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
  return response.json();
}

async function fetchErrorMetrics(startDate: Date, endDate: Date): Promise<ErrorMetrics[]> {
  const response = await fetch(`/api/analytics/errors?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
  return response.json();
}

async function fetchPerformanceMetrics(startDate: Date, endDate: Date): Promise<PerformanceMetrics[]> {
  const response = await fetch(`/api/analytics/performance?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
  return response.json();
}
```

## Best Practices

### 1. Track All Requests

Track all requests:

```typescript
// Good: Track all requests
await analyticsService.trackRequest(
  tenantId,
  userId,
  endpoint,
  method,
  statusCode,
  duration,
  error,
  userAgent,
  ipAddress
);

// Bad: Track only successful requests
if (statusCode < 400) {
  await analyticsService.trackRequest(...);
}
```

### 2. Track Performance Metrics

Track performance metrics:

```typescript
// Good: Track performance metrics
const duration = Date.now() - startTime;
await analyticsService.trackRequest(..., duration, ...);

// Bad: No performance tracking
await analyticsService.trackRequest(...);
```

### 3. Track Errors

Track errors:

```typescript
// Good: Track errors
try {
  const response = await handler(request);
  return response;
} catch (error) {
  await analyticsService.trackRequest(..., error.message, ...);
  throw error;
}

// Bad: No error tracking
const response = await handler(request);
return response;
```

### 4. Use Sampling

Use sampling for high-traffic endpoints:

```typescript
// Good: Use sampling
const config = {
  sampleRate: 0.1, // 10% sampling
};

if (Math.random() > config.sampleRate) {
  return;
}

// Bad: No sampling
// No sampling
```

### 5. Set Retention Period

Set retention period:

```typescript
// Good: Set retention period
const config = {
  retentionDays: 90,
};

// Bad: No retention period
const config = {
  retentionDays: 0,
};
```

### 6. Provide Analytics Dashboard

Provide analytics dashboard:

```typescript
// Good: Provide analytics dashboard
export default function AnalyticsDashboard() {
  return (
    <div>
      <UsageCard metrics={usageMetrics} />
      <ErrorCard metrics={errorMetrics} />
      <PerformanceCard metrics={performanceMetrics} />
    </div>
  );
}

// Bad: No analytics dashboard
// No analytics dashboard
```

### 7. Document Analytics

Document analytics:

```markdown
# Good: Document analytics
## API Analytics

- Track all API requests
- Monitor performance metrics
- Track errors and failures
- View analytics dashboard

# Bad: No documentation
# No documentation
```

## References

- [API Analytics](https://www.postman.com/api-analytics/)
- [Performance Monitoring](https://www.datadoghq.com/product/apm/)
- [Error Tracking](https://sentry.io/)
- [Usage Analytics](https://aws.amazon.com/api-gateway/)
