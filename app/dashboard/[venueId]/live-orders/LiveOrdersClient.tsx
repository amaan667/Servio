"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Clock, ArrowLeft, User, AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/app/authenticated-client-provider";

import ConfigurationDiagnostic from "@/components/ConfigurationDiagnostic";
import { EnvironmentError } from "@/components/EnvironmentError";


interface Order {
  id: string;
  venue_id: string;
  table_number: number | null;
  customer_name: string | null;
  customer_phone?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
  created_at: string;
  status: 'pending' | 'preparing' | 'served';
  payment_status?: string;
}

interface LiveOrdersClientProps {
  venueId: string;
  venueName?: string;
}

interface GroupedHistoryOrders {
  [date: string]: Order[];
}



export default function LiveOrdersClient({ venueId, venueName: venueNameProp }: LiveOrdersClientProps) {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [groupedHistoryOrders, setGroupedHistoryOrders] = useState<GroupedHistoryOrders>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [todayWindow, setTodayWindow] = useState<{ startUtcISO: string; endUtcISO: string } | null>(null);
  const [activeTab, setActiveTab] = useState("live");
  const [venueName, setVenueName] = useState<string>(venueNameProp || '');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected' | 'error'>('connected');

  // Clear error when component mounts or when retrying
  const clearError = useCallback(() => {
    setError(null);
    setIsRetrying(false);
  }, []);

  const loadVenueAndOrders = useCallback(async () => {
    let isMounted = true;
    try {
      clearError();
      setLoading(true);
      setIsRetrying(true);
      
      console.log('[LIVE-ORDERS] Loading orders for venue:', venueId);
      console.log('[LIVE-ORDERS] Auth state:', { authLoading, hasSession: !!session, userId: session?.user?.id });
      console.log('[LIVE-ORDERS] Supabase config:', { 
        isConfigured: isSupabaseConfigured(), 
        hasClient: !!supabase,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'
      });
      
      // Check authentication first
      if (authLoading) {
        console.log('[LIVE-ORDERS] Still loading authentication, skipping...');
        setLoading(false);
        setIsRetrying(false);
        return;
      }
      
      if (!session) {
        console.log('[LIVE-ORDERS] No session found, redirecting to sign-in');
        setError('Authentication required. Please sign in to view live orders.');
        setLoading(false);
        setIsRetrying(false);
        router.push('/sign-in');
        return;
      }
      
      // Check Supabase configuration first
      if (!isSupabaseConfigured()) {
        console.error('[LIVE-ORDERS] Supabase not configured');
        setError('ENVIRONMENT_CONFIG_ERROR');
        setLoading(false);
        setIsRetrying(false);
        return;
      }

      if (!supabase) {
        console.error('[LIVE-ORDERS] Supabase client is null');
        setError('Unable to connect to database');
        setLoading(false);
        setIsRetrying(false);
        return;
      }
      
      // Always verify venue ownership, even if venueNameProp is provided
      const { data: venueData, error: venueError } = await supabase
        .from('venues')
        .select('name, owner_id')
        .eq('venue_id', venueId)
        .single();
        
      if (venueError) {
        console.error('Error fetching venue data:', venueError);
        setError(`Failed to load venue data: ${venueError.message}`);
        setLoading(false);
        setIsRetrying(false);
        return;
      }
      
      if (!venueData) {
        setError('Venue not found');
        setLoading(false);
        setIsRetrying(false);
        return;
      }
      
      // Check if the current user owns this venue
      console.log('[LIVE-ORDERS] Venue ownership check:', { 
        venueOwnerId: venueData.owner_id, 
        currentUserId: session.user.id,
        isOwner: venueData.owner_id === session.user.id 
      });
      
      if (venueData.owner_id !== session.user.id) {
        console.log('[LIVE-ORDERS] User does not own venue, redirecting to dashboard');
        setError('You do not have permission to view orders for this venue');
        setLoading(false);
        setIsRetrying(false);
        router.push('/dashboard');
        return;
      }
      
      // Set venue name if not provided
      if (!venueNameProp) {
        setVenueName(venueData.name || '');
      }
      
      // Use simple date-based window instead of timezone-aware
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      const window = {
        startUtcISO: startOfDay.toISOString(),
        endUtcISO: endOfDay.toISOString(),
      };
      setTodayWindow(window);
      
      // Load live orders (pending/preparing from today)
      console.log('[LIVE-ORDERS] Fetching live orders for window:', window);
      const { data: liveData, error: liveError } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .in('status', ['pending', 'preparing'])
        .gte('created_at', window.startUtcISO)
        .lt('created_at', window.endUtcISO)
        .order('created_at', { ascending: false });

      if (liveError) {
        console.error('[LIVE-ORDERS] Error fetching live orders:', liveError);
        setError(`Failed to load live orders: ${liveError.message}`);
        setLoading(false);
        setIsRetrying(false);
        return;
      }
      
      console.log('[LIVE-ORDERS] Live orders loaded:', liveData?.length || 0);

      // Load all orders from today
      console.log('[LIVE-ORDERS] Fetching all orders for today');
      const { data: allData, error: allError } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .gte('created_at', window.startUtcISO)
        .lt('created_at', window.endUtcISO)
        .order('created_at', { ascending: false });

      if (allError) {
        console.error('[LIVE-ORDERS] Error fetching all orders:', allError);
        setError(`Failed to load all orders: ${allError.message}`);
        setLoading(false);
        setIsRetrying(false);
        return;
      }
      
      console.log('[LIVE-ORDERS] All orders loaded:', allData?.length || 0);

      // Load history orders (not from today)
      console.log('[LIVE-ORDERS] Fetching history orders');
      const { data: historyData, error: historyError } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', venueId)
        .lt('created_at', window.startUtcISO)
        .order('created_at', { ascending: false })
        .limit(100); // Limit to last 100 orders

      if (historyError) {
        console.error('[LIVE-ORDERS] Error fetching history orders:', historyError);
        // Don't fail completely if history fails
        setHistoryOrders([]);
        setGroupedHistoryOrders({});
      } else {
        if (historyData) {
          const history = historyData as Order[];
          setHistoryOrders(history);
          
          // Group history orders by date
          const grouped = history.reduce((acc: GroupedHistoryOrders, order) => {
            const date = formatDate(order.created_at);
            if (!acc[date]) {
              acc[date] = [];
            }
            acc[date].push(order);
            return acc;
          }, {});
          setGroupedHistoryOrders(grouped);
        } else {
          setHistoryOrders([]);
          setGroupedHistoryOrders({});
        }
      }

      // Set orders with null checks
      setOrders((liveData || []) as Order[]);
      setAllOrders((allData || []) as Order[]);
      
      console.log('[LIVE-ORDERS] Successfully loaded all data:', {
        liveOrders: liveData?.length || 0,
        allOrders: allData?.length || 0,
        historyOrders: historyData?.length || 0
      });
      
      if (isMounted) {
        setLoading(false);
        setIsRetrying(false);
        setRetryCount(0); // Reset retry count on success
      }
    } catch (err) {
      console.error('[LIVE-ORDERS] Unexpected error in loadVenueAndOrders:', err);
      if (isMounted) {
        setError(`An unexpected error occurred: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
        setIsRetrying(false);
      }
    }
  }, [venueId, session, authLoading, router, clearError, venueNameProp]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    loadVenueAndOrders();
  }, [loadVenueAndOrders]);

  useEffect(() => {
    let isMounted = true;
    
    // Don't load orders if still loading authentication
    if (authLoading) {
      return;
    }
    
    // Don't load orders if not authenticated
    if (!session) {
      if (isMounted) {
        setError('Authentication required. Please sign in to view live orders.');
        setLoading(false);
      }
      router.push('/sign-in');
      return;
    }
    
    // Load orders when component mounts
    loadVenueAndOrders();

    // Only set up real-time subscription if Supabase is configured
    if (!isSupabaseConfigured() || !supabase) {
      console.log('[LIVE-ORDERS] Skipping real-time subscription - Supabase not configured');
      return;
    }

    console.log('[LIVE-ORDERS] Setting up real-time subscription for venue:', venueId);
    
    // Set up real-time subscription with error handling
    const channel = supabase
      .channel('orders')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        }, 
        (payload) => {
          try {
            // Add null checks to prevent crashes
            if (!payload || !payload.new && !payload.old) {
              console.warn('Received invalid payload in real-time subscription');
              return;
            }

            const orderCreatedAt = (payload.new as Order)?.created_at || (payload.old as Order)?.created_at;
            const isInTodayWindow = orderCreatedAt && todayWindow && orderCreatedAt >= todayWindow.startUtcISO && orderCreatedAt < todayWindow.endUtcISO;
            
            if (payload.eventType === 'INSERT') {
              const newOrder = payload.new as Order;
              if (!newOrder) {
                console.warn('Received INSERT event but no new order data');
                return;
              }
              
              if (isInTodayWindow) {
                setOrders(prev => [newOrder, ...prev]);
                setAllOrders(prev => [newOrder, ...prev]);
              } else {
                setHistoryOrders(prev => [newOrder, ...prev]);
                // Update grouped history
                const date = formatDate(newOrder.created_at);
                setGroupedHistoryOrders(prev => ({
                  ...prev,
                  [date]: [newOrder, ...(prev[date] || [])]
                }));
              }
            } else if (payload.eventType === 'UPDATE') {
              const updatedOrder = payload.new as Order;
              if (!updatedOrder) {
                console.warn('Received UPDATE event but no updated order data');
                return;
              }
              
              if (isInTodayWindow) {
                setOrders(prev => prev.map(order => 
                  order.id === updatedOrder.id ? updatedOrder : order
                ));
                setAllOrders(prev => prev.map(order => 
                  order.id === updatedOrder.id ? updatedOrder : order
                ));
              } else {
                setHistoryOrders(prev => prev.map(order => 
                  order.id === updatedOrder.id ? updatedOrder : order
                ));
              }
            } else if (payload.eventType === 'DELETE') {
              const deletedOrder = payload.old as Order;
              if (!deletedOrder) {
                console.warn('Received DELETE event but no deleted order data');
                return;
              }
              
              if (isInTodayWindow) {
                setOrders(prev => prev.filter(order => order.id !== deletedOrder.id));
                setAllOrders(prev => prev.filter(order => order.id !== deletedOrder.id));
              } else {
                setHistoryOrders(prev => prev.filter(order => order.id !== deletedOrder.id));
              }
            }
          } catch (error) {
            console.error('Error handling real-time subscription update:', error);
          }
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error('Real-time subscription error:', error);
          // Don't set error for real-time subscription failures - just log them
          // This prevents the "try again" issue from real-time connection problems
          console.warn('Real-time connection failed, but continuing with manual refresh capability');
          setRealtimeStatus('error');
        } else {
          console.log('Real-time subscription status:', status);
          setRealtimeStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [venueId, todayWindow, session, authLoading, loadVenueAndOrders]); // Added loadVenueAndOrders dependency

  const updateOrderStatus = async (orderId: string, status: 'preparing' | 'served') => {
    try {
      // Check authentication before making the request
      if (!session) {
        setError('Authentication required. Please sign in to update orders.');
        router.push('/sign-in');
        return;
      }
      
      const response = await fetch(`/api/dashboard/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || 'Unknown error';
        } catch (parseError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        console.error('Error updating order status:', errorMessage);
        setError(`Failed to update order status: ${errorMessage}`);
        return;
      }

      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        setError('Failed to parse server response');
        return;
      }

      const { order } = responseData;
      
      if (!order) {
        console.error('No order data in response');
        setError('No order data received from server');
        return;
      }
      
      // Update local state with the returned order data
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: order.status, payment_status: order.payment_status } : o
      ));
      setAllOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: order.status, payment_status: order.payment_status } : o
      ));
    } catch (err) {
      console.error('Unexpected error updating order status:', err);
      setError(`An unexpected error occurred: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Invalid time';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid date');
      }
      
      const day = date.getDate();
      const month = date.toLocaleDateString('en-GB', { month: 'long' });
      
      // Add ordinal suffix to day
      const getOrdinalSuffix = (day: number) => {
        if (day > 3 && day < 21) return 'th';
        switch (day % 10) {
          case 1: return 'st';
          case 2: return 'nd';
          case 3: return 'rd';
          default: return 'th';
        }
      };
      
      return `${day}${getOrdinalSuffix(day)} ${month}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'served': 
      case 'delivered': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'preparing': return 'Preparing';
      case 'served': 
      case 'delivered': return 'Served';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const renderOrderCard = (order: Order, showActions: boolean = true) => (
    <Card key={order.id} className="hover:shadow-md transition-shadow border-border">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-muted-foreground">
              {formatTime(order.created_at)}
            </div>
            <div className="font-medium text-foreground">
              Table {order.table_number || 'Takeaway'}
            </div>
            {order.customer_name && (
              <div className="flex items-center text-sm text-muted-foreground">
                <User className="h-4 w-4 mr-1" />
                {order.customer_name}
              </div>
            )}
            {!order.customer_name && (
              <div className="flex items-center text-sm text-muted-foreground">
                <User className="h-4 w-4 mr-1" />
                Guest
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getStatusColor(order.status)}>
              {getStatusDisplay(order.status)}
            </Badge>
            {order.payment_status && (
              <Badge className={getPaymentStatusColor(order.payment_status)}>
                {order.payment_status.toUpperCase()}
              </Badge>
            )}
            <div className="text-lg font-bold text-foreground">
              £{order.total_amount.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="space-y-2 mb-4">
          {order.items && order.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-foreground">{item.quantity}x {item.name}</span>
              <span className="text-muted-foreground">£{(item.quantity * item.price).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex space-x-2">
            {order.status === 'pending' && (
              <Button 
                size="sm"
                onClick={() => updateOrderStatus(order.id, 'preparing')}
              >
                Start Preparing
              </Button>
            )}
            {(order.status === 'preparing' || order.status === 'confirmed') && (
              <Button 
                size="sm"
                onClick={() => updateOrderStatus(order.id, 'served')}
              >
                Mark Served
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {isRetrying ? 'Refreshing orders...' : 'Loading orders...'}
          </p>
        </div>
      </div>
    );
  }

  // Show configuration diagnostic if Supabase is not configured
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Configuration Required</h2>
          <p className="text-muted-foreground mb-6">
            The live orders page requires Supabase configuration to function properly.
          </p>
        </div>
        <ConfigurationDiagnostic />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Authentication Required</h3>
          <p className="text-muted-foreground mb-4">Please sign in to view live orders.</p>
          <Button 
            onClick={() => router.push('/sign-in')}
            className="flex items-center space-x-2"
          >
            <span>Sign In</span>
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    // Show environment error component for configuration issues
    if (error === 'ENVIRONMENT_CONFIG_ERROR') {
      return (
        <div className="flex items-center justify-center h-64">
          <EnvironmentError 
            title="Database Configuration Missing"
            message="The live orders page cannot connect to the database because required environment variables are not set."
          />
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {isRetrying ? 'Retrying...' : 'Error Loading Orders'}
          </h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          {retryCount > 0 && (
            <p className="text-sm text-muted-foreground mb-4">
              Retry attempt: {retryCount}
            </p>
          )}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-left">
            <h4 className="text-sm font-medium text-gray-800 mb-2">Debug Information:</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <p>Venue ID: {venueId}</p>
              <p>Auth Loading: {authLoading ? 'Yes' : 'No'}</p>
              <p>Has Session: {session ? 'Yes' : 'No'}</p>
              <p>Supabase Configured: {isSupabaseConfigured() ? 'Yes' : 'No'}</p>
              <p>Supabase Client: {supabase ? 'Available' : 'Null'}</p>
              <p>Environment URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing'}</p>
              <p>Environment Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}</p>
              <p>Retry Count: {retryCount}</p>
              <p>Is Retrying: {isRetrying ? 'Yes' : 'No'}</p>
            </div>
          </div>
          <Button 
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Retrying...' : 'Try Again'}</span>
          </Button>
          {retryCount >= 3 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Having trouble? Try refreshing the page or check your internet connection.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Get current date and time
  const getCurrentDateTime = () => {
    try {
      const now = new Date();
      
      const dateStr = formatDate(now.toISOString());
      
      const timeStr = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      return { dateStr, timeStr };
    } catch (error) {
      console.error('Error getting current date time:', error);
      return { dateStr: 'Error', timeStr: 'Error' };
    }
  };

  const { dateStr, timeStr } = getCurrentDateTime();

  // Update time every minute
  const [currentTime, setCurrentTime] = useState(getCurrentDateTime());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentDateTime());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {/* Real-time order feed description */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <p className="text-sm text-muted-foreground">
            Real-time order feed for {venueName} • {currentTime.dateStr} • {currentTime.timeStr}
          </p>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              realtimeStatus === 'connected' ? 'bg-green-500' : 
              realtimeStatus === 'disconnected' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-xs text-muted-foreground">
              {realtimeStatus === 'connected' ? 'Live' : 
               realtimeStatus === 'disconnected' ? 'Manual' : 'Offline'}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={isRetrying || loading}
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Refreshing...' : 'Refresh'}</span>
        </Button>
      </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="live">Live Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="all">All Today ({allOrders.length})</TabsTrigger>
            <TabsTrigger value="history">History ({historyOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="mt-6">
            <div className="grid gap-6">
              {orders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Active Orders</h3>
                    <p className="text-muted-foreground">New orders will appear here in real-time</p>
                  </CardContent>
                </Card>
              ) : (
                orders.map((order) => renderOrderCard(order, true))
              )}
            </div>
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            <div className="grid gap-6">
              {allOrders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Orders Today</h3>
                    <p className="text-muted-foreground">All orders from today will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                allOrders.map((order) => renderOrderCard(order, false))
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <div className="space-y-8">
              {Object.keys(groupedHistoryOrders).length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Historical Orders</h3>
                    <p className="text-muted-foreground">Previous orders will appear here</p>
                  </CardContent>
                </Card>
              ) : (
                Object.entries(groupedHistoryOrders).map(([date, orders]) => (
                  <div key={date}>
                    <h3 className="text-lg font-semibold text-foreground mb-4 border-b pb-2">{date}</h3>
                    <div className="grid gap-6">
                      {orders.map((order) => renderOrderCard(order, false))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
    </div>
  );
}