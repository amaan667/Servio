"use client";

import React, { useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Clock, TrendingUp, ShoppingBag, Table } from "lucide-react";
import Link from "next/link";
import { useDashboardPrefetch } from '@/hooks/usePrefetch';
import PullToRefresh from '@/components/PullToRefresh';
import { useConnectionMonitor } from '@/lib/connection-monitor';
import { DashboardSkeleton } from '@/components/dashboard-skeleton';
import { useRequestCancellation } from '@/lib/request-utils';
import RoleManagementPopup from '@/components/role-management-popup';
import VenueSwitcherPopup from '@/components/venue-switcher-popup';

// Hooks
import { useDashboardData } from './hooks/useDashboardData';
import { useDashboardRealtime } from './hooks/useDashboardRealtime';
import { useAnalyticsData } from './hooks/useAnalyticsData';

// New Modern Components
import { StatusBanner } from './components/StatusBanner';
import { QuickActionsToolbar } from './components/QuickActionsToolbar';
import { EnhancedStatCard } from './components/EnhancedStatCard';
import { AIInsights } from './components/AIInsights';
import { TodayAtAGlance } from './components/TodayAtAGlance';
import { FeatureSections } from './components/FeatureSections';

/**
 * Modern Venue Dashboard Client Component
 * 
 * Features:
 * - Compact status banner (connection + trial + venue/role)
 * - Horizontal quick actions toolbar
 * - Enhanced KPI cards with trends and tooltips
 * - AI-powered insights
 * - Today at a Glance mini charts
 * - Grouped feature sections
 * - Optimized mobile responsive layout
 */

const DashboardClient = React.memo(function DashboardClient({ 
  venueId, 
  userId, 
  venue: initialVenue, 
  userName,
  venueTz,
  initialCounts,
  initialStats,
  userRole,
  isOwner
}: { 
  venueId: string; 
  userId: string; 
  venue?: unknown; 
  userName: string;
  venueTz: string;
  initialCounts?: unknown;
  initialStats?: unknown;
  userRole?: string;
  isOwner?: boolean;
}) {
  console.log('[DASHBOARD DEBUG] Modern component rendering with props:', {
    venueId,
    userId,
    hasVenue: !!initialVenue,
    userName,
    venueTz,
    hasInitialCounts: !!initialCounts,
    hasInitialStats: !!initialStats,
    userRole,
    isOwner
  });

  const router = useRouter();
  
  // Monitor connection status
  const connectionState = useConnectionMonitor();
  
  // Handle venue change
  const handleVenueChange = useCallback((newVenueId: string) => {
    console.debug('[VENUE SWITCH] Switching from', venueId, 'to', newVenueId);
    router.push(`/dashboard/${newVenueId}`);
  }, [venueId, router]);
  
  // Request cancellation
  const { createRequest, cancelRequest } = useRequestCancellation();
  
  // Enable intelligent prefetching for dashboard routes
  useDashboardPrefetch(venueId);

  // Custom hooks for dashboard data and realtime
  console.log('[DASHBOARD DEBUG] Calling useDashboardData hook...');
  const dashboardData = useDashboardData(venueId, venueTz, initialVenue, initialCounts, initialStats);
  console.log('[DASHBOARD DEBUG] useDashboardData returned:', {
    loading: dashboardData.loading,
    hasVenue: !!dashboardData.venue,
    hasTodayWindow: !!dashboardData.todayWindow,
    hasError: !!dashboardData.error,
    counts: dashboardData.counts,
    stats: dashboardData.stats
  });
  
  console.log('[DASHBOARD DEBUG] Setting up realtime subscription...');
  useDashboardRealtime({
    venueId,
    todayWindow: dashboardData.todayWindow,
    refreshCounts: dashboardData.refreshCounts,
    loadStats: dashboardData.loadStats,
    updateRevenueIncrementally: dashboardData.updateRevenueIncrementally,
    venue: dashboardData.venue
  });

  // Fetch live analytics data for charts
  const analyticsData = useAnalyticsData(venueId, venueTz);

  const handleRefresh = useCallback(async () => {
    console.log('[DASHBOARD DEBUG] handleRefresh called');
    await dashboardData.refreshCounts();
    if (dashboardData.venue?.venue_id && dashboardData.todayWindow) {
      await dashboardData.loadStats(dashboardData.venue.venue_id, dashboardData.todayWindow);
    }
  }, [dashboardData]);

  // Auto-refresh when returning from checkout success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('upgrade') === 'success') {
      console.debug('[DASHBOARD] Detected upgrade success, refreshing dashboard data');
      setTimeout(() => {
        handleRefresh();
        const url = new URL(window.location.href);
        url.searchParams.delete('upgrade');
        window.history.replaceState({}, document.title, url.toString());
      }, 1000);
    }
  }, [handleRefresh]);

  // Use live analytics data or fallback to empty data
  const ordersByHour = useMemo(() => {
    if (analyticsData.data?.ordersByHour && analyticsData.data.ordersByHour.length > 0) {
      return analyticsData.data.ordersByHour;
    }
    // Fallback: return empty data for all hours
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      orders: 0,
    }));
  }, [analyticsData.data?.ordersByHour]);

  const tableUtilization = useMemo(() => {
    if (!dashboardData.counts.tables_set_up) return 0;
    return Math.round((dashboardData.counts.tables_in_use / dashboardData.counts.tables_set_up) * 100);
  }, [dashboardData.counts]);

  const revenueByCategory = useMemo(() => {
    if (analyticsData.data?.revenueByCategory && analyticsData.data.revenueByCategory.length > 0) {
      return analyticsData.data.revenueByCategory;
    }
    return [];
  }, [analyticsData.data?.revenueByCategory]);

  console.log('[DASHBOARD DEBUG] Checking loading state:', dashboardData.loading);

  if (dashboardData.loading) {
    console.log('[DASHBOARD DEBUG] Rendering loading skeleton');
    return <DashboardSkeleton />;
  }

  console.log('[DASHBOARD DEBUG] Rendering main dashboard content');

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-gray-50/50">
        {/* Compact Status Banner */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <StatusBanner
              isOnline={connectionState.isOnline}
              isOffline={connectionState.isOffline}
              trialDaysLeft={14}
              venueName={dashboardData.venue?.name || 'Venue'}
              userRole={userRole}
              onVenueChange={handleVenueChange}
            />
          </div>
        </div>

        {/* Quick Actions Toolbar */}
        <QuickActionsToolbar venueId={venueId} userRole={userRole} />

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Error Alert */}
          {dashboardData.error && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-center gap-3 animate-in slide-in-from-top">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-sm font-bold">!</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error Loading Dashboard</p>
                <p className="text-xs text-red-700">{dashboardData.error}</p>
              </div>
            </div>
          )}

          {/* Enhanced KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Link href={`/dashboard/${venueId}/live-orders?since=today`}>
              <EnhancedStatCard
                title="Today's Orders"
                value={dashboardData.counts.today_orders_count}
                icon={Clock}
                iconColor="text-blue-600"
                iconBgColor="bg-blue-100"
                trend={analyticsData.data?.yesterdayComparison ? {
                  value: dashboardData.counts.today_orders_count - analyticsData.data.yesterdayComparison.orders,
                  label: 'vs yesterday'
                } : undefined}
                tooltip="View all orders placed today"
              />
            </Link>

            {(userRole === 'owner' || userRole === 'manager') && (
              <Link href={`/dashboard/${venueId}/analytics`}>
                <EnhancedStatCard
                  title="Revenue"
                  value={`£${dashboardData.stats.revenue.toFixed(2)}`}
                  icon={TrendingUp}
                  iconColor="text-green-600"
                  iconBgColor="bg-green-100"
                  trend={analyticsData.data?.yesterdayComparison ? {
                    value: dashboardData.stats.revenue - analyticsData.data.yesterdayComparison.revenue,
                    label: 'vs yesterday'
                  } : undefined}
                  tooltip="View detailed revenue analytics"
                />
              </Link>
            )}

            <Link href={`/dashboard/${venueId}/tables`}>
              <EnhancedStatCard
                title="Tables Set Up"
                value={dashboardData.counts.tables_set_up}
                icon={Table}
                iconColor="text-purple-600"
                iconBgColor="bg-purple-100"
                trend={{ value: 0, label: 'all active' }}
                tooltip="Manage table setup and reservations"
              />
            </Link>

            <Link href={`/dashboard/${venueId}/menu-management`}>
              <EnhancedStatCard
                title="Menu Items"
                value={dashboardData.stats.menuItems}
                icon={ShoppingBag}
                iconColor="text-orange-600"
                iconBgColor="bg-orange-100"
                trend={{ value: 5, label: 'available' }}
                tooltip="Edit your menu items"
              />
            </Link>
          </div>

          {/* AI Insights */}
          <AIInsights
            venueId={venueId}
            stats={{
              revenue: dashboardData.stats.revenue,
              menuItems: dashboardData.stats.menuItems,
              todayOrdersCount: dashboardData.counts.today_orders_count
            }}
            topSellingItems={analyticsData.data?.topSellingItems}
            yesterdayComparison={analyticsData.data?.yesterdayComparison}
          />

          {/* Today at a Glance */}
          <Suspense fallback={<div className="h-[300px] bg-white rounded-lg animate-pulse" />}>
            <TodayAtAGlance
              ordersByHour={ordersByHour}
              tableUtilization={tableUtilization}
              revenueByCategory={revenueByCategory}
              loading={analyticsData.loading}
            />
          </Suspense>

          {/* Feature Sections */}
          <FeatureSections venueId={venueId} userRole={userRole} />
        </div>

        {/* Footer Modals */}
        <RoleManagementPopup userId={userId} />
        <VenueSwitcherPopup 
          currentVenueId={venueId}
          onVenueChange={handleVenueChange}
        />
      </div>
    </PullToRefresh>
  );
});

export default DashboardClient;

