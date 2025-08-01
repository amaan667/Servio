"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  Users,
  TrendingUp,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LiveOrders } from "@/components/live-orders";
import { MenuManagement } from "@/components/menu-management";
import { NavBar } from "@/components/NavBar";

export default function VenueDashboardPage({ params }: { params: { venueId: string } }) {
  const [session, setSession] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("live");
  const [quickSetupVisible, setQuickSetupVisible] = useState(true);
  const [stats, setStats] = useState({
    todayOrders: 0,
    revenue: 0,
    activeTables: 0,
    menuItems: 0
  });
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        const { data: venueData, error } = await supabase
          .from("venues")
          .select("*")
          .eq("owner_id", session.user.id)
          .single();
        
        if (!error && venueData) {
          setVenue(venueData);
          await loadStats(venueData.venue_id);
        }
      }
      
      setLoading(false);
    };
    
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadStats = async (venueId: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: orders } = await supabase
        .from("orders")
        .select("total_amount")
        .eq("venue_id", venueId)
        .gte("created_at", today.toISOString());

      const { data: menuItems } = await supabase
        .from("menu_items")
        .select("id")
        .eq("venue_id", venueId)
        .eq("available", true);

      setStats({
        todayOrders: orders?.length || 0,
        revenue: orders?.reduce((sum: number, order: any) => sum + order.total_amount, 0) || 0,
        activeTables: 0,
        menuItems: menuItems?.length || 0
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleQuickAction = (action: string) => {
    setActiveTab(action);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.replace("/sign-in");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, {session?.user?.user_metadata?.full_name || "Manager"}!
          </h2>
          <p className="text-gray-600">
            Here's what's happening at {venue?.name || "your venue"} today
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="live">Live Dashboard</TabsTrigger>
            <TabsTrigger value="menu">Menu Management</TabsTrigger>
            <TabsTrigger value="qr">QR Codes</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
          </TabsList>

          <TabsContent value="live">
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Today's Orders</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.todayOrders}</p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Clock className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">£{stats.revenue.toFixed(2)}</p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Active Tables</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.activeTables}</p>
                      </div>
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Users className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Menu Items</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.menuItems}</p>
                      </div>
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                        <ShoppingBag className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Orders - Takes up 2/3 of the space */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold mb-4">Live Orders</h3>
                      <LiveOrders venueId={params.venueId} />
                    </CardContent>
                  </Card>
                </div>
                
                {/* Quick Setup Card */}
                {quickSetupVisible && (
                  <div className="lg:col-span-1">
                    <Card>
                      <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-4">Quick Setup</h3>
                        <div className="space-y-3">
                          <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => handleQuickAction("menu")}
                          >
                            Add Menu Items
                          </Button>
                          <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => handleQuickAction("qr")}
                          >
                            Generate QR Codes
                          </Button>
                          <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => handleQuickAction("staff")}
                          >
                            Invite Staff
                          </Button>
                          <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => router.push(`/order?venue=${venue?.venue_id}&demo=true`)}
                          >
                            Test Order Flow
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="menu">
            <Card>
              <CardContent className="p-6">
                <MenuManagement venueId={params.venueId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="qr">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">QR Code Management</h3>
                <p className="text-gray-500">Generate and manage QR codes for your tables.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staff">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Staff Management</h3>
                <p className="text-gray-500">Invite and manage your staff members.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
