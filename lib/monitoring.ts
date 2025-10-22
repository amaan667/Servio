/**
 * Monitoring and Error Tracking Service
 * Provides centralized error tracking, performance monitoring, and analytics
 */

interface ErrorContext {
  userId?: string;
  venueId?: string;
  action?: string;
  metadata?: Record<string, any>;
}

interface PerformanceMetric {
  name: string;
  duration: number;
  metadata?: Record<string, any>;
}

class MonitoringService {
  private isProduction = process.env.NODE_ENV === 'production';

  /**
   * Track errors with context
   */
  captureException(error: Error, context?: ErrorContext) {
    console.error('[ERROR]', {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });

    // In production, send to external monitoring service
    if (this.isProduction) {
      // TODO: Integrate with Sentry or similar service
      this.sendToExternalService('error', { error, context });
    }
  }

  /**
   * Track custom events
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error', context?: ErrorContext) {
    console.log(`[${level.toUpperCase()}]`, {
      message,
      context,
      timestamp: new Date().toISOString()
    });

    if (this.isProduction) {
      this.sendToExternalService('message', { message, level, context });
    }
  }

  /**
   * Track performance metrics
   */
  trackPerformance(metric: PerformanceMetric) {
    console.log('[PERFORMANCE]', {
      name: metric.name,
      duration: `${metric.duration}ms`,
      metadata: metric.metadata,
      timestamp: new Date().toISOString()
    });

    if (this.isProduction) {
      this.sendToExternalService('performance', metric);
    }
  }

  /**
   * Track user actions
   */
  trackUserAction(action: string, userId: string, metadata?: Record<string, any>) {
    console.log('[USER_ACTION]', {
      action,
      userId,
      metadata,
      timestamp: new Date().toISOString()
    });

    if (this.isProduction) {
      this.sendToExternalService('user_action', { action, userId, metadata });
    }
  }

  /**
   * Track API performance
   */
  trackAPICall(endpoint: string, method: string, duration: number, statusCode: number) {
    this.trackPerformance({
      name: `api_${method}_${endpoint}`,
      duration,
      metadata: { method, endpoint, statusCode }
    });
  }

  private sendToExternalService(type: string, data: unknown) {
    // TODO: Implement actual external service integration
    // This could be Sentry, DataDog, New Relic, etc.
    console.log(`[EXTERNAL_SERVICE] Sending ${type}:`, data);
  }
}

export const monitoring = new MonitoringService();

/**
 * Performance tracking decorator
 */
export function trackPerformance(name: string) {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: unknown[]) {
      const start = performance.now();
      try {
        const result = await method.apply(this, args);
        const duration = performance.now() - start;
        monitoring.trackPerformance({ name, duration });
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        monitoring.trackPerformance({ name, duration, metadata: { error: true } });
        throw error;
      }
    };
  };
}

/**
 * Error boundary for React components
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: unknown) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    monitoring.captureException(error, {
      action: 'react_error_boundary',
      metadata: { errorInfo }
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">We're sorry for the inconvenience.</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}