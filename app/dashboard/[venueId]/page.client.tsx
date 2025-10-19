"use client";

import React, { useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { Clock, Users, TrendingUp, ShoppingBag, BarChart, QrCode, Settings, Plus, Table, Wifi, WifiOff, AlertTriangle, ChefHat, Package } from "lucide-react";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useDashboardPrefetch } from '@/hooks/usePrefetch';
import PullToRefresh from '@/components/PullToRefresh';
import { useConnectionMonitor } from '@/lib/connection-monitor';
import { DashboardSkeleton } from '@/components/dashboard-skeleton';
import { useRequestCancellation } from '@/lib/request-utils';
import OnboardingCompletionBanner from '@/components/onboarding-completion-banner';
import TrialStatusBanner from '@/components/TrialStatusBanner';
import RoleManagementPopup from '@/components/role-management-popup';
import VenueSwitcherPopup from '@/components/venue-switcher-popup';

// Hooks
import { useDashboardData } from './hooks/useDashboardData';
import { useDashboardRealtime } from './hooks/useDashboardRealtime';

// Components
import { DashboardStatCard } from './components/DashboardStatCard';
import { QuickActionCard } from './components/QuickActionCard';

/**
 * Venue Dashboard Client Component
 * Main dashboard view showing overview stats and quick actions
 * 
 * Refactored: Extracted hooks and components for better organization
 * Original: 805 lines → Now: ~200 lines
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
  venue?: any; 
  userName: string;
  venueTz: string;
  initialCounts?: any;
  initialStats?: any;
  userRole?: string;
  isOwner?: boolean;
}) {
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
  const dashboardData = useDashboardData(venueId, venueTz, initialVenue, initialCounts, initialStats);
  
  useDashboardRealtime({
    venueId,
    todayWindow: dashboardData.todayWindow,
    refreshCounts: dashboardData.refreshCounts,
    loadStats: dashboardData.loadStats,
    updateRevenueIncrementally: dashboardData.updateRevenueIncrementally,
    venue: dashboardData.venue
  });

  const handleRefresh = useCallback(async () => {
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

  const quickActions = useMemo(() => {
    const actions = [
      { label: 'New Order', href: `/dashboard/${venueId}/live-orders`, icon: Plus, description: 'Create order', variant: 'default' as const },
      { label: 'View Orders', href: `/dashboard/${venueId}/live-orders`, icon: Clock, description: 'Live orders' },
      { label: 'Menu Builder', href: `/dashboard/${venueId}/menu-management`, icon: ShoppingBag, description: 'Edit menu' },
      { label: 'QR Codes', href: `/dashboard/${venueId}/qr-codes`, icon: QrCode, description: 'Generate QR' },
    ];

    if (userRole === 'owner' || userRole === 'manager') {
      actions.push(
        { label: 'Analytics', href: `/dashboard/${venueId}/analytics`, icon: BarChart, description: 'View insights' },
        { label: 'Settings', href: `/dashboard/${venueId}/settings`, icon: Settings, description: 'Configure' }
      );
    }

    return actions;
  }, [venueId, userRole]);

  if (dashboardData.loading) {
    return <DashboardSkeleton />;
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6 pb-32 md:pb-8">
        {/* Connection Status */}
        {connectionState.isOffline && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-orange-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-900">Connection Lost</p>
              <p className="text-xs text-orange-700">Some features may not work properly</p>
            </div>
          </div>
        )}

        {connectionState.isOnline && !connectionState.isOffline && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <Wifi className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-900">Connected</p>
          </div>
        )}

        {/* Error Alert */}
        {dashboardData.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Error</p>
              <p className="text-xs text-red-700">{dashboardData.error}</p>
            </div>
          </div>
        )}

        {/* Banners */}
        <OnboardingCompletionBanner venueId={venueId} venue={dashboardData.venue} />
        <TrialStatusBanner organization={null} />

        {/* Quick Actions */}
        <QuickActionCard title="Quick Actions" actions={quickActions} />

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Link href={`/dashboard/${venueId}/live-orders?since=today`}>
            <DashboardStatCard
              title="Today's Orders"
              value={dashboardData.counts.today_orders_count}
              icon={Clock}
              iconColor="text-blue-600"
              iconBgColor="bg-blue-100"
            />
          </Link>

          {(userRole === 'owner' || userRole === 'manager') && (
            <Link href={`/dashboard/${venueId}/analytics`}>
              <DashboardStatCard
                title="Revenue"
                value={`£${dashboardData.stats.revenue.toFixed(2)}`}
                icon={TrendingUp}
                iconColor="text-green-600"
                iconBgColor="bg-green-100"
              />
            </Link>
          )}

          <Link href={`/dashboard/${venueId}/tables`}>
            <DashboardStatCard
              title="Tables Set Up"
              value={dashboardData.counts.tables_set_up}
              icon={Table}
              iconColor="text-purple-600"
              iconBgColor="bg-purple-100"
            />
          </Link>

          <Link href={`/dashboard/${venueId}/menu-management`}>
            <DashboardStatCard
              title="Menu Items"
              value={dashboardData.stats.menuItems}
              icon={ShoppingBag}
              iconColor="text-orange-600"
              iconBgColor="bg-orange-100"
            />
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Link href={`/dashboard/${venueId}/live-orders`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Live Orders</h3>
                <p className="text-gray-700 text-xs sm:text-sm font-medium">Monitor and manage incoming orders in real-time</p>
              </CardContent>
            </Card>
          </Link>

          {(userRole === 'owner' || userRole === 'manager' || userRole === 'kitchen') && (
            <Link href={`/dashboard/${venueId}/kds`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                    <ChefHat className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Kitchen Display</h3>
                  <p className="text-gray-700 text-xs sm:text-sm font-medium">Real-time kitchen order management and display</p>
                </CardContent>
              </Card>
            </Link>
          )}

          <Link href={`/dashboard/${venueId}/menu-management`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                  <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Menu Builder</h3>
                <p className="text-gray-700 text-xs sm:text-sm font-medium">Design, manage, and customize your menu</p>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${venueId}/qr-codes`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <QrCode className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">QR Codes</h3>
                <p className="text-gray-700 text-xs sm:text-sm font-medium">Generate and manage QR codes for your tables</p>
              </CardContent>
            </Card>
          </Link>

          {dashboardData.venue?.has_tables !== false && (
            <Link href={`/dashboard/${venueId}/tables`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                    <Table className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Table Management</h3>
                  <p className="text-gray-700 text-xs sm:text-sm font-medium">Monitor table status and manage service flow</p>
                </CardContent>
              </Card>
            </Link>
          )}

          {(userRole === 'owner' || userRole === 'manager') && (
            <Link href={`/dashboard/${venueId}/analytics`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <BarChart className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Analytics</h3>
                  <p className="text-gray-700 text-xs sm:text-sm font-medium">Deep insights into your restaurant performance</p>
                </CardContent>
              </Card>
            </Link>
          )}

          <Link href={`/dashboard/${venueId}/feedback`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Feedback</h3>
                <p className="text-gray-700 text-xs sm:text-sm font-medium">See customer reviews and ratings</p>
              </CardContent>
            </Card>
          </Link>

          {(userRole === 'owner' || userRole === 'manager') && (
            <Link href={`/dashboard/${venueId}/staff`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-slate-700" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Staff Management</h3>
                  <p className="text-gray-700 text-xs sm:text-sm font-medium">Manage your team, roles, and permissions</p>
                </CardContent>
              </Card>
            </Link>
          )}

          <Link href={`/dashboard/${venueId}/inventory`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                  <Package className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2 text-foreground">Inventory Management</h3>
                <p className="text-gray-700 text-xs sm:text-sm font-medium">Track ingredients, stock levels, and costs</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Getting Started Section */}
        {(!dashboardData.venue?.venue_name || dashboardData.stats.menuItems === 0) && (
          <div className="mt-12">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-foreground">Getting Started</h3>
                <p className="text-gray-700 font-medium">Complete these steps to set up your venue</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!dashboardData.venue?.venue_name && (
                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        1
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">Set up your venue</h4>
                        <p className="text-sm text-gray-700 mb-3">Add your venue details and operating hours</p>
                        <Button asChild size="sm">
                          <Link href={`/dashboard/${venueId}/settings`}>Go to Settings</Link>
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {dashboardData.stats.menuItems === 0 && (
                    <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg">
                      <div className="w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        2
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">Add your menu</h4>
                        <p className="text-sm text-gray-700 mb-3">Upload your menu or add items manually</p>
                        <Button asChild size="sm">
                          <Link href={`/dashboard/${venueId}/menu-management`}>Go to Menu Builder</Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Role Management Popup */}
      <RoleManagementPopup venueId={venueId} userRole={userRole} />

      {/* Venue Switcher Popup */}
      <VenueSwitcherPopup onVenueChange={handleVenueChange} />
    </PullToRefresh>
  );
});

export default DashboardClient;
