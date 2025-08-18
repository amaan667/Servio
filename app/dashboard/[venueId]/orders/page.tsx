"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LiveOrders } from "@/components/live-orders";
import NavBar from "@/components/NavBar";
import { useRouter } from "next/navigation";
import { Session } from "@supabase/supabase-js";

interface Venue {
  venue_id: string;
  name: string;
  owner_id: string;
}

export default function OrdersPage({ params }: { params: { venueId: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayOrders: 0,
    revenue: 0
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

      setStats({
        todayOrders: orders?.length || 0,
        revenue: orders?.reduce((sum: number, order: any) => sum + order.total_amount, 0) || 0
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Live Orders</h2>
          <p className="text-gray-600">Monitor and manage incoming orders in real-time</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                  <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">£{stats.revenue.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Orders */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Orders</h3>
          </CardHeader>
          <CardContent>
            <LiveOrders 
              venueId={params.venueId}
              session={session}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
