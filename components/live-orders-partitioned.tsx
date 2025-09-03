"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, History, Calendar } from "lucide-react";
import { OrderCard, type Order } from "@/components/order-card";
import { useLiveOrders, useTodayOrders, useHistoryOrders } from '@/hooks/usePartitionedOrders';

interface LiveOrdersPartitionedProps {
  venueId: string;
  venueTimezone?: string;
}

export function LiveOrdersPartitioned({ venueId, venueTimezone = 'Europe/London' }: LiveOrdersPartitionedProps) {
  const [activeTab, setActiveTab] = useState<'live' | 'today' | 'history'>('live');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date());

  // Use the partitioned hooks for mutually exclusive order sets
  const { data: liveData, isLoading: liveLoading, error: liveError, refetch: refetchLive } = useLiveOrders(venueId, venueTimezone);
  const { data: todayData, isLoading: todayLoading, error: todayError, refetch: refetchToday } = useTodayOrders(venueId, venueTimezone);
  const { data: historyData, isLoading: historyLoading, error: historyError, refetch: refetchHistory } = useHistoryOrders(venueId, venueTimezone);

  // Auto-refresh all queries on the same interval
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[AUTH DEBUG] Auto-refreshing all order queries');
      refetchLive();
      refetchToday();
      refetchHistory();
      setLastUpdatedAt(new Date());
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [refetchLive, refetchToday, refetchHistory]);

  // Get current tab data and loading state
  const getCurrentTabData = () => {
    switch (activeTab) {
      case 'live':
        return { data: liveData, loading: liveLoading, error: liveError };
      case 'today':
        return { data: todayData, loading: todayLoading, error: todayError };
      case 'history':
        return { data: historyData, loading: historyLoading, error: historyError };
      default:
        return { data: liveData, loading: liveLoading, error: liveError };
    }
  };

  const { data: currentData, loading: currentLoading, error: currentError } = getCurrentTabData();

  // Get tab count for badges
  const getTabCount = (tab: 'live' | 'today' | 'history') => {
    switch (tab) {
      case 'live':
        return liveData?.count || 0;
      case 'today':
        return todayData?.count || 0;
      case 'history':
        return historyData?.count || 0;
      default:
        return 0;
    }
  };

  const getTabLabel = (tab: string) => {
    switch (tab) {
      case 'live':
        return 'Live (Last 30 Min)';
      case 'today':
        return 'Today (All Orders)';
      case 'history':
        return 'History';
      default:
        return 'Live (Last 30 Min)';
    }
  };

  const getTabDescription = (tab: string) => {
    switch (tab) {
      case 'live':
        return "Orders placed within the last 30 minutes";
      case 'today':
        return "All orders placed today (excluding live orders)";
      case 'history':
        return "All orders from previous days";
      default:
        return "Orders placed within the last 30 minutes";
    }
  };

  if (currentError) {
    return (
      <Alert className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{currentError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Order Management</h1>
          <p className="text-muted-foreground">
            Manage orders across different time windows
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchLive();
              refetchToday();
              refetchHistory();
              setLastUpdatedAt(new Date());
            }}
            disabled={currentLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${currentLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {lastUpdatedAt && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastUpdatedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-4">
        <Button
          variant={activeTab === 'live' ? 'default' : 'outline'}
          className="flex items-center justify-between"
          onClick={() => setActiveTab('live')}
        >
          <span>Live</span>
          {getTabCount('live') > 0 && (
            <Badge variant="destructive" className="ml-2">
              {getTabCount('live')}
            </Badge>
          )}
        </Button>
        <Button
          variant={activeTab === 'today' ? 'default' : 'outline'}
          className="flex items-center justify-between"
          onClick={() => setActiveTab('today')}
        >
          <span>Today</span>
          {getTabCount('today') > 0 && (
            <Badge variant="secondary" className="ml-2">
              {getTabCount('today')}
            </Badge>
          )}
        </Button>
        <Button
          variant={activeTab === 'history' ? 'default' : 'outline'}
          className="flex items-center justify-between"
          onClick={() => setActiveTab('history')}
        >
          <span>History</span>
          {getTabCount('history') > 0 && (
            <Badge variant="outline" className="ml-2">
              {getTabCount('history')}
            </Badge>
          )}
        </Button>
      </div>

      {/* Tab Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {activeTab === 'live' && <Clock className="h-5 w-5" />}
            {activeTab === 'today' && <Calendar className="h-5 w-5" />}
            {activeTab === 'history' && <History className="h-5 w-5" />}
            <span>{getTabLabel(activeTab)}</span>
          </CardTitle>
          <CardDescription>{getTabDescription(activeTab)}</CardDescription>
        </CardHeader>
        <CardContent>
          {currentLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 mx-auto text-gray-400 animate-spin mb-4" />
              <p className="text-gray-600">Loading orders...</p>
            </div>
          ) : currentData?.rows && currentData.rows.length > 0 ? (
            <div className="space-y-4">
              {currentData.rows.map((order: Order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders</h3>
              <p className="text-gray-500">
                {activeTab === 'live' && "Orders placed within the last 30 minutes will appear here"}
                {activeTab === 'today' && "Today's orders (excluding live orders) will appear here"}
                {activeTab === 'history' && "Orders from previous days will appear here"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
