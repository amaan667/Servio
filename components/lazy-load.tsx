'use client';

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// Lazy load components with loading state
export function createLazyComponent<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  LoadingComponent?: ComponentType
) {
  return dynamic(importFunc, {
    loading: LoadingComponent
      ? () => <LoadingComponent />
      : () => (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ),
    ssr: false,
  }) as ComponentType<P>;
}

// Pre-configured lazy components for common patterns
// Using dynamic import directly to avoid type issues
export const LazyAnalyticsDashboard = dynamic(
  () => import('@/components/analytics-dashboard').then(mod => ({ default: mod.AnalyticsDashboard })),
  { ssr: false }
);

export const LazyDemoAISection = dynamic(
  () => import('@/components/demo-ai-section'),
  { ssr: false }
);

export const LazyDemoAnalytics = dynamic(
  () => import('@/components/demo-analytics'),
  { ssr: false }
);

export const LazyEnhancedFeedbackSystem = dynamic(
  () => import('@/components/enhanced-feedback-system').then(mod => ({ default: mod.EnhancedFeedbackSystem })),
  { ssr: false }
);

// Loading skeleton for dashboard
export function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-24 bg-gray-200 rounded"></div>
        <div className="h-24 bg-gray-200 rounded"></div>
        <div className="h-24 bg-gray-200 rounded"></div>
      </div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  );
}

