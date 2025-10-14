"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ChefHat, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default function KitchenPage() {
  const [venueId, setVenueId] = useState<string>('');
  const [venueName, setVenueName] = useState<string>('Your Kitchen');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const getSession = async () => {
      const supabase = createClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        return;
      }
      
      setSession(session);
      
      if (session?.user) {
        // Get user's venue
        const { data: venues, error: venueError } = await supabase
          .from('venues')
          .select('venue_id, venue_name')
          .eq('owner_user_id', session.user.id)
          .order('created_at', { ascending: true })
          .limit(1);
          
        if (venueError) {
          console.error('Error fetching venue:', venueError);
          return;
        }
        
        if (venues && venues.length > 0) {
          const userVenue = venues[0];
          setVenueId(userVenue.venue_id);
          setVenueName(userVenue.venue_name);
          setVenue(userVenue);
          await loadOrders(userVenue.venue_id);
        } else {
          // No venue found, redirect to complete profile
          router.push('/complete-profile');
        }
      } else {
        // No session, redirect to sign in
        router.push('/sign-in');
      }
    };

    getSession();
  }, [router]);

  const loadOrders = async (vid: string) => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      // Load active orders for the kitchen
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('venue_id', vid)
        .in('order_status', ['PLACED', 'PREPARING', 'READY'])
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error loading orders:', ordersError);
        toast({
          title: "Error",
          description: "Failed to load orders",
          variant: "destructive",
        });
        return;
      }

      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error in loadOrders:', error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('orders')
        .update({ order_status: status })
        .eq('id', orderId);

      if (error) {
        throw error;
      }

      toast({
        title: "Order updated",
        description: `Order status changed to ${status.toLowerCase()}`,
      });

      await loadOrders(venueId);
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update order",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLACED': return 'bg-yellow-100 text-yellow-800';
      case 'PREPARING': return 'bg-blue-100 text-blue-800';
      case 'READY': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PLACED': return <AlertCircle className="h-4 w-4" />;
      case 'PREPARING': return <Clock className="h-4 w-4" />;
      case 'READY': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading kitchen orders...</p>
        </div>
      </div>
    );
  }

  if (!venueId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No venue found. Please complete your profile first.</p>
          <Button onClick={() => router.push('/complete-profile')} className="mt-4">
            Complete Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Kitchen Display System
          </h1>
          <p className="text-lg text-foreground mt-2">
            Manage and track kitchen orders in real-time
          </p>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map(order => (
            <Card key={order.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <ChefHat className="h-5 w-5" />
                    <span>Order #{order.id.slice(-6)}</span>
                  </CardTitle>
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.order_status)}`}>
                    {getStatusIcon(order.order_status)}
                    <span>{order.order_status}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{order.customer_name || 'Walk-in'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Table:</span>
                    <span className="font-medium">{order.table_number || 'Counter'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="font-medium">{formatTime(order.created_at)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">${order.total_amount || '0.00'}</span>
                  </div>
                </div>

                {/* Order Items */}
                {order.order_items && order.order_items.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Items:</h4>
                    <div className="space-y-1">
                      {order.order_items.slice(0, 3).map((item: any, index: number) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          {item.quantity}x {item.name}
                        </div>
                      ))}
                      {order.order_items.length > 3 && (
                        <div className="text-sm text-muted-foreground">
                          +{order.order_items.length - 3} more items
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-2">
                  {order.order_status === 'PLACED' && (
                    <Button
                      onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                      className="flex-1"
                      size="sm"
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      Start Cooking
                    </Button>
                  )}
                  {order.order_status === 'PREPARING' && (
                    <Button
                      onClick={() => updateOrderStatus(order.id, 'READY')}
                      className="flex-1"
                      size="sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Mark Ready
                    </Button>
                  )}
                  {order.order_status === 'READY' && (
                    <Button
                      onClick={() => updateOrderStatus(order.id, 'SERVED')}
                      className="flex-1"
                      size="sm"
                      variant="outline"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Mark Served
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {orders.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <ChefHat className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No active orders</h3>
              <p className="text-muted-foreground">Kitchen orders will appear here when customers place them.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
