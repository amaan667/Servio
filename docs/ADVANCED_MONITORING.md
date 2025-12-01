# Advanced Monitoring & Observability

Servio includes comprehensive monitoring and observability features.

## Overview

The monitoring system tracks:
- **Errors**: Application errors and exceptions
- **Performance**: Response times, query performance
- **Metrics**: Business metrics, user activity
- **Alerts**: Critical issues and thresholds

## Error Tracking

### Sentry Integration

Sentry is configured for error tracking:

```typescript
import * as Sentry from "@sentry/nextjs";

// Capture exception
try {
  // Risky operation
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      feature: "orders",
      venueId: venueId,
    },
    extra: {
      orderId: orderId,
      userId: userId,
    },
  });
}

// Capture message
Sentry.captureMessage("Order processing delayed", {
  level: "warning",
  tags: {
    feature: "orders",
  },
});
```

### Custom Error Tracking

```typescript
import { logger } from "@/lib/logger";
import { monitoring } from "@/lib/monitoring";

// Track error with context
monitoring.trackEvent(
  "order_creation_failed",
  "error",
  "Failed to create order",
  {
    venueId,
    error: error.message,
    stack: error.stack,
  }
);
```

## Performance Monitoring

### API Route Performance

```typescript
import { withErrorHandling } from "@/lib/api/handler-wrapper";

export const GET = withErrorHandling(async (req, body) => {
  const startTime = Date.now();
  
  // Your logic here
  
  const duration = Date.now() - startTime;
  
  if (duration > 1000) {
    logger.warn("Slow API request", {
      endpoint: req.url,
      duration,
    });
  }
  
  return result;
}, { logResponse: true });
```

### Database Query Performance

```typescript
async function timedQuery<T>(
  queryFn: () => Promise<T>,
  queryName: string
): Promise<T> {
  const start = performance.now();
  try {
    const result = await queryFn();
    const duration = performance.now() - start;
    
    if (duration > 500) {
      logger.warn(`Slow query: ${queryName}`, { duration });
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`Query failed: ${queryName}`, { duration, error });
    throw error;
  }
}
```

### Frontend Performance

```typescript
import { usePerformance } from "@/hooks/usePerformance";

function MyComponent() {
  const { measureComponentRender } = usePerformance();
  const render = measureComponentRender("MyComponent");
  
  useEffect(() => {
    render.start();
    return () => {
      render.end();
    };
  }, []);
}
```

## Metrics Collection

### Business Metrics

```typescript
import { trackBusinessMetric } from "@/lib/analytics/business-metrics";

// Track order creation
trackBusinessMetric("order_created", {
  venueId,
  orderValue: totalAmount,
  itemCount: items.length,
  paymentMethod: paymentMethod,
});

// Track revenue
trackBusinessMetric("revenue", {
  venueId,
  amount: totalAmount,
  date: new Date().toISOString(),
});
```

### User Activity

```typescript
import { trackUserActivity } from "@/lib/analytics";

trackUserActivity("page_view", {
  page: "/dashboard",
  userId,
  venueId,
});

trackUserActivity("action", {
  action: "order_created",
  userId,
  venueId,
  metadata: {
    orderId,
    totalAmount,
  },
});
```

## Custom Dashboards

### Creating a Dashboard

```typescript
// lib/monitoring/dashboard.tsx
export function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<Metrics>({});
  
  useEffect(() => {
    // Fetch metrics
    fetchMetrics().then(setMetrics);
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchMetrics().then(setMetrics);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div>
      <MetricCard title="Orders Today" value={metrics.ordersToday} />
      <MetricCard title="Revenue" value={metrics.revenue} />
      <MetricCard title="Active Users" value={metrics.activeUsers} />
    </div>
  );
}
```

## Alerting

### Critical Alerts

```typescript
import { monitoring } from "@/lib/monitoring";

// Send critical alert
monitoring.trackEvent(
  "payment_processing_failed",
  "critical",
  "Payment processing system is down",
  {
    venueId,
    errorCount: 10,
  }
);
```

### Alert Configuration

Alerts can be configured to send to:
- **Email**: Via SendGrid/Resend
- **Slack**: Via webhook
- **Sentry**: Automatic for errors
- **Custom**: Via webhook

## Logging

### Structured Logging

```typescript
import { logger } from "@/lib/logger";

// Info log
logger.info("Order created", {
  orderId,
  venueId,
  totalAmount,
});

// Warning log
logger.warn("Low stock", {
  ingredientId,
  currentStock,
  threshold,
});

// Error log
logger.error("Payment failed", {
  orderId,
  error: error.message,
  stack: error.stack,
});
```

### Log Levels

- **debug**: Development debugging
- **info**: General information
- **warn**: Warnings
- **error**: Errors
- **critical**: Critical issues

## Health Checks

### Application Health

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    supabase: await checkSupabase(),
  };
  
  const healthy = Object.values(checks).every(c => c.status === "ok");
  
  return NextResponse.json({
    status: healthy ? "healthy" : "unhealthy",
    checks,
    timestamp: new Date().toISOString(),
  });
}
```

## Performance Budgets

### Bundle Size Monitoring

Configured in `next.config.mjs`:

```javascript
config.performance = {
  maxAssetSize: 5000000, // 5MB
  maxEntrypointSize: 5000000, // 5MB
  hints: 'warning',
};
```

### API Response Time

Monitor in CI/CD:

```yaml
- name: Check API response time
  run: |
    RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/health)
    if (( $(echo "$RESPONSE_TIME > 1.0" | bc -l) )); then
      echo "API response time too high: $RESPONSE_TIME"
      exit 1
    fi
```

## Tools

### Sentry

- Error tracking
- Performance monitoring
- Release tracking
- User feedback

### Custom Monitoring

- Business metrics
- Custom dashboards
- Alerting
- Log aggregation

## Best Practices

1. **Log Context**: Always include relevant context
2. **Monitor Key Metrics**: Track business-critical metrics
3. **Set Alerts**: Configure alerts for critical issues
4. **Review Regularly**: Review metrics and logs regularly
5. **Optimize**: Use metrics to identify bottlenecks

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Next.js Monitoring](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Web Vitals](https://web.dev/vitals/)


