/**
 * Performance Monitoring
 * Tracks Core Web Vitals and performance metrics
 */

import { logger } from '@/lib/logger';

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id: string;
}

export interface PerformanceReport {
  timestamp: string;
  url: string;
  metrics: PerformanceMetric[];
  userAgent: string;
}

/**
 * Web Vitals thresholds
 */
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

/**
 * Get rating for a metric
 */
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Report Web Vitals
 */
export function reportWebVitals(metric: PerformanceMetric) {
  const { name, value, rating, delta, id } = metric;

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    logger.info(`[WEB VITALS] ${name}:`, {
      value: value.toFixed(2),
      rating,
      delta,
    });
  }

  // Send to analytics in production
  if (process.env.NODE_ENV === 'production') {
    sendToAnalytics(metric);
  }
}

/**
 * Send metrics to analytics
 */
async function sendToAnalytics(metric: PerformanceMetric) {
  try {
    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      metrics: [metric],
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
    };

    // Send to your analytics endpoint
    await fetch('/api/analytics/vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
  } catch (error) {
    logger.error('Failed to send performance metrics', error);
  }
}

/**
 * Track API performance
 */
export async function trackAPIPerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - startTime;

    logger.info(`[API PERFORMANCE] ${name}:`, {
      duration: `${duration.toFixed(2)}ms`,
      status: 'success',
    });

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;

    logger.error(`[API PERFORMANCE] ${name}:`, {
      duration: `${duration.toFixed(2)}ms`,
      status: 'error',
      error,
    });

    throw error;
  }
}

/**
 * Track component render performance
 */
export function trackComponentRender(componentName: string) {
  const startTime = performance.now();

  return {
    end: () => {
      const duration = performance.now() - startTime;

      if (duration > 16) { // > 1 frame at 60fps
        logger.warn(`[RENDER PERFORMANCE] ${componentName}:`, {
          duration: `${duration.toFixed(2)}ms`,
          warning: 'Slow render detected',
        });
      }
    },
  };
}

/**
 * Monitor bundle size
 */
export function monitorBundleSize() {
  if (typeof window === 'undefined') return;

  const scripts = Array.from(document.querySelectorAll('script[src]'));
  let totalSize = 0;

  scripts.forEach(script => {
    const src = script.getAttribute('src');
    if (src) {
      // Estimate size from URL (rough approximation)
      const size = src.length * 2; // Rough estimate
      totalSize += size;
    }
  });

  logger.info('[BUNDLE SIZE]', {
    scripts: scripts.length,
    estimatedSize: `${(totalSize / 1024).toFixed(2)}KB`,
  });

  return totalSize;
}

/**
 * Get performance summary
 */
export function getPerformanceSummary(): {
  memory?: any;
  timing?: any;
  navigation?: any;
} {
  if (typeof window === 'undefined') return {};

  const performance = window.performance;
  const memory = (performance as any).memory;
  const timing = performance.timing;
  const navigation = performance.getEntriesByType('navigation')[0] as any;

  return {
    memory: memory ? {
      used: `${(memory.usedJSHeapSize / 1048576).toFixed(2)}MB`,
      total: `${(memory.totalJSHeapSize / 1048576).toFixed(2)}MB`,
      limit: `${(memory.jsHeapSizeLimit / 1048576).toFixed(2)}MB`,
    } : undefined,
    timing: timing ? {
      dns: `${timing.domainLookupEnd - timing.domainLookupStart}ms`,
      tcp: `${timing.connectEnd - timing.connectStart}ms`,
      request: `${timing.responseStart - timing.requestStart}ms`,
      response: `${timing.responseEnd - timing.responseStart}ms`,
      dom: `${timing.domComplete - timing.domLoading}ms`,
      load: `${timing.loadEventEnd - timing.navigationStart}ms`,
    } : undefined,
    navigation: navigation ? {
      type: navigation.type,
      redirect: `${navigation.redirectEnd - navigation.redirectStart}ms`,
      dns: `${navigation.domainLookupEnd - navigation.domainLookupStart}ms`,
      tcp: `${navigation.connectEnd - navigation.connectStart}ms`,
      request: `${navigation.responseStart - navigation.requestStart}ms`,
      response: `${navigation.responseEnd - navigation.responseStart}ms`,
      dom: `${navigation.domComplete - navigation.domLoading}ms`,
      load: `${navigation.loadEventEnd - navigation.loadEventStart}ms`,
    } : undefined,
  };
}

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') return;

  // Monitor bundle size
  monitorBundleSize();

  // Log performance summary
  setTimeout(() => {
    const summary = getPerformanceSummary();
    logger.info('[PERFORMANCE SUMMARY]', summary);
  }, 3000);
}

