# Performance Budgets

This document describes the performance budget strategy and implementation for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Budget Categories](#budget-categories)
3. [Budget Limits](#budget-limits)
4. [Implementation](#implementation)
5. [Monitoring and Alerting](#monitoring-and-alerting)
6. [Enforcement](#enforcement)
7. [Best Practices](#best-practices)

## Overview

Performance budgets are limits set on various performance metrics to ensure the Servio platform remains fast and responsive. These budgets help:

- **Maintain Performance**: Prevent performance regressions
- **Set Expectations**: Define acceptable performance levels
- **Guide Development**: Inform optimization priorities
- **Ensure Quality**: Deliver consistent user experience

## Budget Categories

### 1. Bundle Size Budgets

Limits on JavaScript and CSS bundle sizes.

| Metric | Budget | Current | Status |
|--------|--------|---------|--------|
| Initial JS Bundle | 200 KB | - | - |
| Total JS Bundle | 500 KB | - | - |
| Initial CSS Bundle | 50 KB | - | - |
| Total CSS Bundle | 100 KB | - | - |
| Total Assets | 1 MB | - | - |

### 2. Load Time Budgets

Limits on page load times.

| Metric | Budget | Current | Status |
|--------|--------|---------|--------|
| First Contentful Paint (FCP) | 1.5s | - | - |
| Largest Contentful Paint (LCP) | 2.5s | - | - |
| First Input Delay (FID) | 100ms | - | - |
| Time to Interactive (TTI) | 3.5s | - | - |
| Cumulative Layout Shift (CLS) | 0.1 | - | - |
| Total Blocking Time (TBT) | 300ms | - | - |

### 3. API Response Budgets

Limits on API response times.

| Metric | Budget | Current | Status |
|--------|--------|---------|--------|
| API Response Time (p50) | 100ms | - | - |
| API Response Time (p95) | 500ms | - | - |
| API Response Time (p99) | 1s | - | - |
| Database Query Time | 100ms | - | - |
| External API Call Time | 500ms | - | - |

### 4. Database Budgets

Limits on database operations.

| Metric | Budget | Current | Status |
|--------|--------|---------|--------|
| Query Execution Time | 100ms | - | - |
| Connection Pool Usage | 80% | - | - |
| Active Connections | 100 | - | - |
| Query Throughput | 1000 QPS | - | - |

### 5. Resource Budgets

Limits on resource usage.

| Metric | Budget | Current | Status |
|--------|--------|---------|--------|
| Memory Usage | 512 MB | - | - |
| CPU Usage | 70% | - | - |
| Disk Usage | 80% | - | - |
| Network Bandwidth | 1 Gbps | - | - |

## Budget Limits

### Bundle Size Limits

```typescript
// next.config.mjs
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance budgets
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.performance = {
        maxEntrypointSize: 200000, // 200 KB
        maxAssetSize: 500000, // 500 KB
        hints: 'warning',
      };
    }
    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
```

### Load Time Limits

```typescript
// lib/performance/budgets.ts
export const PERFORMANCE_BUDGETS = {
  // Core Web Vitals
  fcp: 1500, // 1.5s
  lcp: 2500, // 2.5s
  fid: 100, // 100ms
  tti: 3500, // 3.5s
  cls: 0.1,
  tbt: 300, // 300ms

  // Custom metrics
  firstPaint: 1000, // 1s
  domContentLoaded: 2000, // 2s
  loadComplete: 3000, // 3s
} as const;

export function checkPerformanceBudgets(metrics: PerformanceMetrics): BudgetReport {
  const violations: BudgetViolation[] = [];

  if (metrics.fcp > PERFORMANCE_BUDGETS.fcp) {
    violations.push({
      metric: 'FCP',
      budget: PERFORMANCE_BUDGETS.fcp,
      actual: metrics.fcp,
      severity: 'warning',
    });
  }

  if (metrics.lcp > PERFORMANCE_BUDGETS.lcp) {
    violations.push({
      metric: 'LCP',
      budget: PERFORMANCE_BUDGETS.lcp,
      actual: metrics.lcp,
      severity: 'error',
    });
  }

  if (metrics.fid > PERFORMANCE_BUDGETS.fid) {
    violations.push({
      metric: 'FID',
      budget: PERFORMANCE_BUDGETS.fid,
      actual: metrics.fid,
      severity: 'error',
    });
  }

  if (metrics.tti > PERFORMANCE_BUDGETS.tti) {
    violations.push({
      metric: 'TTI',
      budget: PERFORMANCE_BUDGETS.tti,
      actual: metrics.tti,
      severity: 'warning',
    });
  }

  if (metrics.cls > PERFORMANCE_BUDGETS.cls) {
    violations.push({
      metric: 'CLS',
      budget: PERFORMANCE_BUDGETS.cls,
      actual: metrics.cls,
      severity: 'error',
    });
  }

  if (metrics.tbt > PERFORMANCE_BUDGETS.tbt) {
    violations.push({
      metric: 'TBT',
      budget: PERFORMANCE_BUDGETS.tbt,
      actual: metrics.tbt,
      severity: 'warning',
    });
  }

  return {
    passed: violations.length === 0,
    violations,
    timestamp: Date.now(),
  };
}
```

### API Response Limits

```typescript
// lib/api/budgets.ts
export const API_BUDGETS = {
  responseTime: {
    p50: 100, // 100ms
    p95: 500, // 500ms
    p99: 1000, // 1s
  },
  databaseQuery: 100, // 100ms
  externalApiCall: 500, // 500ms
} as const;

export function checkApiBudgets(
  endpoint: string,
  responseTime: number
): BudgetReport {
  const violations: BudgetViolation[] = [];

  if (responseTime > API_BUDGETS.responseTime.p99) {
    violations.push({
      metric: 'API Response Time',
      budget: API_BUDGETS.responseTime.p99,
      actual: responseTime,
      severity: 'error',
      context: { endpoint },
    });
  } else if (responseTime > API_BUDGETS.responseTime.p95) {
    violations.push({
      metric: 'API Response Time',
      budget: API_BUDGETS.responseTime.p95,
      actual: responseTime,
      severity: 'warning',
      context: { endpoint },
    });
  }

  return {
    passed: violations.length === 0,
    violations,
    timestamp: Date.now(),
  };
}
```

## Implementation

### Lighthouse CI

```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/dashboard
            http://localhost:3000/orders
          uploadArtifacts: true
          temporaryPublicStorage: true
          budgetPath: ./.github/lighthouse-budget.json
```

```json
// .github/lighthouse-budget.json
{
  "budgets": [
    {
      "path": "/*",
      "timings": [
        {
          "metric": "first-contentful-paint",
          "budget": 1500
        },
        {
          "metric": "largest-contentful-paint",
          "budget": 2500
        },
        {
          "metric": "first-input-delay",
          "budget": 100
        },
        {
          "metric": "cumulative-layout-shift",
          "budget": 0.1
        },
        {
          "metric": "total-blocking-time",
          "budget": 300
        }
      ],
      "resourceSizes": [
        {
          "resourceType": "script",
          "budget": 200000
        },
        {
          "resourceType": "stylesheet",
          "budget": 50000
        },
        {
          "resourceType": "total",
          "budget": 1000000
        }
      ],
      "resourceCounts": [
        {
          "resourceType": "script",
          "budget": 10
        },
        {
          "resourceType": "stylesheet",
          "budget": 3
        }
      ]
    }
  ]
}
```

### Webpack Bundle Analyzer

```javascript
// next.config.mjs
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... other config
};

module.exports = withBundleAnalyzer(nextConfig);
```

```json
// package.json
{
  "scripts": {
    "analyze": "ANALYZE=true npm run build"
  }
}
```

### Custom Performance Monitoring

```typescript
// lib/performance/monitor.ts
import { checkPerformanceBudgets } from './budgets';
import { createLogger } from '../structured-logger';

const logger = createLogger('performance');

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getPercentile(name: string, percentile: number): number {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  checkBudgets(): BudgetReport {
    const metrics: PerformanceMetrics = {
      fcp: this.getPercentile('fcp', 95),
      lcp: this.getPercentile('lcp', 95),
      fid: this.getPercentile('fid', 95),
      tti: this.getPercentile('tti', 95),
      cls: this.getPercentile('cls', 95),
      tbt: this.getPercentile('tbt', 95),
    };

    const report = checkPerformanceBudgets(metrics);

    if (!report.passed) {
      logger.warn('Performance budget violations detected', {
        violations: report.violations,
      });
    }

    return report;
  }
}

export const performanceMonitor = new PerformanceMonitor();
```

## Monitoring and Alerting

### Prometheus Metrics

```typescript
// lib/monitoring/performance-metrics.ts
import { register, Histogram, Gauge } from 'prom-client';

export const performanceMetrics = {
  fcp: new Histogram({
    name: 'performance_fcp_seconds',
    help: 'First Contentful Paint duration',
    buckets: [0.5, 1, 1.5, 2, 2.5, 3, 5],
    registers: [register],
  }),

  lcp: new Histogram({
    name: 'performance_lcp_seconds',
    help: 'Largest Contentful Paint duration',
    buckets: [1, 1.5, 2, 2.5, 3, 4, 5],
    registers: [register],
  }),

  fid: new Histogram({
    name: 'performance_fid_seconds',
    help: 'First Input Delay duration',
    buckets: [0.05, 0.1, 0.15, 0.2, 0.3, 0.5],
    registers: [register],
  }),

  tti: new Histogram({
    name: 'performance_tti_seconds',
    help: 'Time to Interactive duration',
    buckets: [2, 2.5, 3, 3.5, 4, 5],
    registers: [register],
  }),

  cls: new Histogram({
    name: 'performance_cls',
    help: 'Cumulative Layout Shift',
    buckets: [0.05, 0.1, 0.15, 0.2, 0.25],
    registers: [register],
  }),

  tbt: new Histogram({
    name: 'performance_tbt_seconds',
    help: 'Total Blocking Time',
    buckets: [0.1, 0.2, 0.3, 0.4, 0.5],
    registers: [register],
  }),

  budgetViolations: new Gauge({
    name: 'performance_budget_violations',
    help: 'Number of performance budget violations',
    labelNames: ['metric', 'severity'],
    registers: [register],
  }),
};
```

### Alert Rules

```yaml
# prometheus-alerts.yml
groups:
  - name: performance_budgets
    interval: 1m
    rules:
      - alert: FCPBudgetExceeded
        expr: histogram_quantile(0.95, rate(performance_fcp_seconds_bucket[5m])) > 1.5
        for: 5m
        labels:
          severity: warning
          budget: 'FCP'
        annotations:
          summary: "FCP budget exceeded"
          description: "p95 FCP is {{ $value }}s (budget: 1.5s)"

      - alert: LCPBudgetExceeded
        expr: histogram_quantile(0.95, rate(performance_lcp_seconds_bucket[5m])) > 2.5
        for: 5m
        labels:
          severity: error
          budget: 'LCP'
        annotations:
          summary: "LCP budget exceeded"
          description: "p95 LCP is {{ $value }}s (budget: 2.5s)"

      - alert: FIDBudgetExceeded
        expr: histogram_quantile(0.95, rate(performance_fid_seconds_bucket[5m])) > 0.1
        for: 5m
        labels:
          severity: error
          budget: 'FID'
        annotations:
          summary: "FID budget exceeded"
          description: "p95 FID is {{ $value }}s (budget: 0.1s)"

      - alert: CLSBudgetExceeded
        expr: histogram_quantile(0.95, rate(performance_cls_bucket[5m])) > 0.1
        for: 5m
        labels:
          severity: error
          budget: 'CLS'
        annotations:
          summary: "CLS budget exceeded"
          description: "p95 CLS is {{ $value }} (budget: 0.1)"

      - alert: TBTBudgetExceeded
        expr: histogram_quantile(0.95, rate(performance_tbt_seconds_bucket[5m])) > 0.3
        for: 5m
        labels:
          severity: warning
          budget: 'TBT'
        annotations:
          summary: "TBT budget exceeded"
          description: "p95 TBT is {{ $value }}s (budget: 0.3s)"
```

## Enforcement

### Pre-commit Hooks

```bash
#!/bin/bash
# .husky/pre-commit

# Check bundle size
npm run analyze

# Run Lighthouse CI
npm run lighthouse-ci

# Check for violations
if [ $? -ne 0 ]; then
  echo "❌ Performance budget violations detected. Please fix before committing."
  exit 1
fi
```

### CI/CD Pipeline

```yaml
# .github/workflows/performance.yml
name: Performance Checks

on:
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Analyze bundle size
        run: npm run analyze

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
          budgetPath: ./.github/lighthouse-budget.json

      - name: Check performance budgets
        run: npm run check-performance-budgets
```

### Runtime Enforcement

```typescript
// lib/performance/enforcement.ts
import { checkPerformanceBudgets } from './budgets';
import { createLogger } from '../structured-logger';

const logger = createLogger('performance');

export function enforcePerformanceBudgets(metrics: PerformanceMetrics): void {
  const report = checkPerformanceBudgets(metrics);

  if (!report.passed) {
    const criticalViolations = report.violations.filter(
      v => v.severity === 'error'
    );

    if (criticalViolations.length > 0) {
      logger.error('Critical performance budget violations', {
        violations: criticalViolations,
      });

      // In production, you might want to:
      // - Send alerts to monitoring system
      // - Rollback recent changes
      // - Notify team members
      // - Enable degraded mode

      throw new Error(
        `Critical performance budget violations: ${criticalViolations.map(v => v.metric).join(', ')}`
      );
    }

    const warningViolations = report.violations.filter(
      v => v.severity === 'warning'
    );

    if (warningViolations.length > 0) {
      logger.warn('Performance budget warnings', {
        violations: warningViolations,
      });
    }
  }
}
```

## Best Practices

### 1. Set Realistic Budgets

Base budgets on user expectations and device capabilities:

```typescript
// Good: Based on Core Web Vitals
const budgets = {
  lcp: 2500, // 2.5s - Good threshold
  fid: 100, // 100ms - Good threshold
  cls: 0.1, // 0.1 - Good threshold
};

// Bad: Too strict
const budgets = {
  lcp: 500, // 0.5s - Unrealistic for most apps
  fid: 10, // 10ms - Unrealistic for most apps
  cls: 0.01, // 0.01 - Unrealistic for most apps
};
```

### 2. Monitor Continuously

Track performance metrics over time:

```typescript
// Monitor performance on every page load
useEffect(() => {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'largest-contentful-paint') {
        performanceMonitor.recordMetric('lcp', entry.startTime);
      }
    }
  });

  observer.observe({ entryTypes: ['largest-contentful-paint'] });

  return () => observer.disconnect();
}, []);
```

### 3. Test on Real Devices

Test on actual devices, not just emulators:

```typescript
// Use WebPageTest for real device testing
const testUrl = 'https://servio.com';
const locations = ['Dulles:Chrome', 'London:Chrome', 'Tokyo:Chrome'];
const devices = ['iPhone', 'Pixel', 'Desktop'];

for (const location of locations) {
  for (const device of devices) {
    const result = await runWebPageTest(testUrl, { location, device });
    checkPerformanceBudgets(result.metrics);
  }
}
```

### 4. Optimize Incrementally

Optimize performance in small increments:

```typescript
// Good: Incremental optimization
1. Reduce bundle size by 10%
2. Improve LCP by 200ms
3. Reduce TBT by 50ms

// Bad: Try to optimize everything at once
1. Optimize everything
```

### 5. Communicate Violations

Share performance budget violations with the team:

```typescript
// Send Slack notification on violations
if (!report.passed) {
  await sendSlackNotification({
    channel: '#performance',
    message: `Performance budget violations detected:\n${report.violations.map(v => `- ${v.metric}: ${v.actual}ms (budget: ${v.budget}ms)`).join('\n')}`,
  });
}
```

### 6. Review Regularly

Review and update budgets regularly:

```typescript
// Review budgets quarterly
const QUARTERLY_BUDGET_REVIEW = async () => {
  const currentMetrics = await getPerformanceMetrics();
  const userFeedback = await getUserFeedback();

  // Adjust budgets based on metrics and feedback
  if (userFeedback.satisfaction < 0.8) {
    // Tighten budgets
    PERFORMANCE_BUDGETS.lcp *= 0.9;
  } else if (currentMetrics.lcp < PERFORMANCE_BUDGETS.lcp * 0.8) {
    // Loosen budgets if consistently under
    PERFORMANCE_BUDGETS.lcp *= 1.1;
  }
};
```

## References

- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Webpack Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)
- [Performance Budgets](https://web.dev/performance-budgets-101/)
- [Core Web Vitals](https://web.dev/learn-web-vitals/)
