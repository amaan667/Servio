"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  QrCode,
  Settings,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  Clock,
  DollarSign,
  Users,
  TrendingUp,
} from "lucide-react";
import {
  getValidatedSession,
  supabase,
  signOutUser,
  type AuthSession,
} from "@/lib/supabase";
import { logger } from "@/lib/logger";

interface DashboardStats {
  todaysOrders: number;
  revenue: number;
  activeTables: number;
  growth: number;
}

interface RecentOrder {
  id: string;
  table_number: number;
  customer_name: string;
  total_amount: number;
  created_at: string;
  status: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    todaysOrders: 0,
    revenue: 0,
    activeTables: 0,
    growth: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  useEffect(() => {
    logger.info("DASHBOARD: Initializing dashboard");

    const validatedSession = getValidatedSession();
    if (!validatedSession) {
      logger.warn("DASHBOARD: No valid session found, redirecting to sign-in");
      router.push("/sign-in");
      return;
    }

    // Check if user owns a venue (business profile)
    async function checkProfile() {
      if (!supabase || !validatedSession) return;
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("owner_id", validatedSession.user.id)
        .maybeSingle();
      if (!data || error) {
        router.replace("/complete-profile");
        return;
      }
      setSession(validatedSession);
      setLoading(false);
      // Fetch dashboard data
      fetchDashboardData(validatedSession.venue.id);
    }
    checkProfile();
  }, [router]);

  const fetchDashboardData = async (venueId: string) => {
    if (!supabase) return;

    try {
      // Get today's orders
      const today = new Date().toISOString().split("T")[0];
      const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", today)
        .order("created_at", { ascending: false });

      if (!error && orders) {
        const todaysOrders = orders.length;
        const revenue = orders.reduce(
          (sum, order) => sum + order.total_amount,
          0,
        );
        const activeTables = new Set(
          orders
            .filter((o) => o.status !== "completed")
            .map((o) => o.table_number),
        ).size;

        setStats({
          todaysOrders,
          revenue,
          activeTables,
          growth: 0, // Calculate based on previous period if needed
        });

        setRecentOrders(orders.slice(0, 5));
        logger.info("DASHBOARD", {
          message: "Dashboard data fetched",
          stats,
          recentOrders,
        });
      }
    } catch (error) {
      logger.error("DASHBOARD", {
        message: "Unexpected error fetching dashboard data",
        error,
      });
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setSession(null);
    router.push("/");
  };

  // Place this function inside the Dashboard component so it can access session
  async function handleDeleteAccount() {
    if (!session) return;
    if (
      !window.confirm(
        "Are you sure you want to permanently delete your account? This cannot be undone.",
      )
    )
      return;
    try {
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          venueId: session.venue.venue_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Account deleted. You will be signed out.");
        await signOutUser();
        window.location.href = "/";
      } else {
        alert("Failed to delete account: " + (data.message || "Unknown error"));
      }
    } catch (err) {
      alert("Failed to delete account. Please try again.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 mx-auto text-gray-400 animate-spin mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Session expired. Please sign in again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Today's Orders
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.todaysOrders}
                  </p>
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
                  <p className="text-2xl font-bold text-gray-900">
                    £{stats.revenue.toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Active Tables
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.activeTables}
                  </p>
                </div>
                <div className="w-12 h-12 bg-servio-purple/10 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-servio-purple" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Growth</p>
                  <p className="text-2xl font-bold text-gray-900">
                    +{stats.growth}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5 text-servio-purple" />
                Manage Venue
              </CardTitle>
              <CardDescription>
                Update menu items, venue settings, and staff management
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() =>
                  router.push(`/dashboard/${session.venue.venue_id}`)
                }
                className="w-full bg-servio-purple hover:bg-servio-purple-dark"
              >
                Open Venue Management
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ExternalLink className="mr-2 h-5 w-5 text-servio-purple" />
                View Order Page
              </CardTitle>
              <CardDescription>
                See how customers view and place orders from your menu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    `/order?venue=${session.venue.venue_id}&table=1`,
                    "_blank",
                  )
                }
                className="w-full"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Order Page
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <QrCode className="mr-2 h-5 w-5 text-servio-purple" />
                Generate QR Codes
              </CardTitle>
              <CardDescription>
                Create QR codes for tables and print them for customer use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => router.push("/generate-qr")}
                className="w-full"
              >
                <QrCode className="mr-2 h-4 w-4" />
                Generate QR Codes
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">
                  No orders yet today. Orders will appear here as they come in.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2 border-b last:border-b-0"
                  >
                    <div>
                      <p className="font-medium">
                        Table {order.table_number} - {order.customer_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-green-600">
                        £{order.total_amount.toFixed(2)}
                      </span>
                      <Badge
                        variant={
                          order.status === "completed" ? "default" : "secondary"
                        }
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Delete Account Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 flex justify-end">
        <Button variant="destructive" onClick={handleDeleteAccount}>
          Delete Account
        </Button>
      </div>
    </div>
  );
}
