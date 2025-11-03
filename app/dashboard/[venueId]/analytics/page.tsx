/**
 * Analytics Dashboard
 * Provides business insights and performance metrics
 */

import { createServerSupabaseReadOnly } from "@/lib/supabase";
import { redirect } from "next/navigation";
import AnalyticsClient from "./AnalyticsClient";
import { logger } from "@/lib/logger";

export const metadata = {
  title: "Analytics | Servio",
  description: "Business analytics and insights for your venue",
};

export default async function AnalyticsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  logger.info("[ANALYTICS] ========== ANALYTICS PAGE LOAD START ==========");
  logger.info("[ANALYTICS] VenueId:", { venueId });

  // Use createServerSupabaseReadOnly to respect user's auth cookies
  const supabase = await createServerSupabaseReadOnly();
  logger.info("[ANALYTICS] Supabase client created");

  // Check authentication from user's session
  const authResult = await supabase.auth.getUser();
  logger.info("[ANALYTICS] Auth result:", {
    hasUser: !!authResult.data?.user,
    userId: authResult.data?.user?.id,
    hasError: !!authResult.error,
    error: authResult.error?.message,
  });

  // Try getSession as well to see what we get
  const sessionResult = await supabase.auth.getSession();
  logger.info("[ANALYTICS] Session result:", {
    hasSession: !!sessionResult.data?.session,
    sessionUserId: sessionResult.data?.session?.user?.id,
    hasError: !!sessionResult.error,
    error: sessionResult.error?.message,
  });

  const user = authResult.data?.user || sessionResult.data?.session?.user;

  if (!user) {
    logger.error("[ANALYTICS] ❌ NO USER FOUND - Auth and Session both failed");
    logger.error("[ANALYTICS] This indicates cookies are not accessible or session expired");

    // DON'T REDIRECT - Show error message instead
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-4">Authentication Debug</h1>
          <div className="space-y-2 text-sm">
            <p className="text-red-600 font-medium">No user session found</p>
            <p className="text-gray-600">Auth Error: {authResult.error?.message || "None"}</p>
            <p className="text-gray-600">Session Error: {sessionResult.error?.message || "None"}</p>
            <p className="text-gray-600 mt-4">
              This page requires authentication. The server cannot access your session cookies.
            </p>
            <a
              href={`/dashboard/${venueId}`}
              className="mt-4 w-full block text-center bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  logger.info("[ANALYTICS] ✅ User authenticated:", { userId: user.id, email: user.email });

  // Check if user is the venue owner
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("venue_id, owner_user_id")
    .eq("venue_id", venueId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  logger.info("[ANALYTICS] Owner check:", {
    isOwner: !!venue,
    venueError: venueError?.message,
    queriedVenueId: venueId,
    userId: user.id,
  });

  const isOwner = !!venue;

  // Check if user has staff role for this venue
  const { data: staff, error: staffError } = await supabase
    .from("user_venue_roles")
    .select("role")
    .eq("venue_id", venueId)
    .eq("user_id", user.id)
    .maybeSingle();

  logger.info("[ANALYTICS] Staff check:", {
    isStaff: !!staff,
    role: staff?.role,
    staffError: staffError?.message,
  });

  const isStaff = !!staff;

  if (!isOwner && !isStaff) {
    logger.error("[ANALYTICS] ❌ NO ACCESS - User is neither owner nor staff");

    // DON'T REDIRECT - Show error message
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">
            You do not have permission to view analytics for this venue.
          </p>
          <a
            href="/dashboard"
            className="mt-4 w-full block text-center bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  logger.info("[ANALYTICS] ✅ Access granted - Loading analytics data");

  // Fetch analytics data
  const [ordersData, menuData, feedbackData, revenueData] = await Promise.all([
    fetchOrderAnalytics(venueId),
    fetchMenuAnalytics(venueId),
    fetchFeedbackAnalytics(venueId),
    fetchRevenueAnalytics(venueId),
  ]);

  return (
    <AnalyticsClient
      venueId={venueId}
      ordersData={ordersData}
      menuData={menuData}
      feedbackData={feedbackData}
      revenueData={revenueData}
    />
  );
}

/**
 * Fetch order analytics
 */
async function fetchOrderAnalytics(venueId: string) {
  const supabase = await createServerSupabaseReadOnly();

  // Get orders from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, created_at, total_amount, status, payment_status")
    .eq("venue_id", venueId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  return {
    totalOrders: orders?.length || 0,
    avgOrderValue:
      (orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0) / (orders?.length || 1),
    ordersByStatus: groupBy(orders || [], "status"),
    ordersByDay: groupByDay(orders || []),
    recentOrders: orders?.slice(0, 10) || [],
  };
}

/**
 * Fetch menu analytics
 */
async function fetchMenuAnalytics(venueId: string) {
  const supabase = await createServerSupabaseReadOnly();

  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, name, category, price, image_url, is_available")
    .eq("venue_id", venueId);

  // Get order items to find popular items
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("menu_item_id, quantity")
    .in("menu_item_id", menuItems?.map((i) => i.id) || []);

  // Calculate popularity
  const popularityMap = new Map<string, number>();
  orderItems?.forEach((item) => {
    const current = popularityMap.get(item.menu_item_id) || 0;
    popularityMap.set(item.menu_item_id, current + item.quantity);
  });

  const topItems = (menuItems || [])
    .map((item) => ({
      ...item,
      ordersCount: popularityMap.get(item.id) || 0,
    }))
    .sort((a, b) => b.ordersCount - a.ordersCount)
    .slice(0, 10);

  return {
    totalItems: menuItems?.length || 0,
    itemsByCategory: groupBy(menuItems || [], "category"),
    itemsWithImages: menuItems?.filter((i) => i.image_url).length || 0,
    unavailableItems: menuItems?.filter((i) => !i.is_available).length || 0,
    topSellingItems: topItems,
  };
}

/**
 * Fetch feedback analytics
 */
async function fetchFeedbackAnalytics(venueId: string) {
  const supabase = await createServerSupabaseReadOnly();

  const { data: feedback } = await supabase
    .from("customer_feedback")
    .select("overall_rating, food_quality, service_quality, value_rating, created_at")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });

  const avgRating =
    (feedback?.reduce((sum, f) => sum + (f.overall_rating || 0), 0) || 0) / (feedback?.length || 1);

  return {
    totalFeedback: feedback?.length || 0,
    avgOverallRating: avgRating,
    avgFoodQuality:
      (feedback?.reduce((sum, f) => sum + (f.food_quality || 0), 0) || 0) / (feedback?.length || 1),
    avgServiceQuality:
      (feedback?.reduce((sum, f) => sum + (f.service_quality || 0), 0) || 0) /
      (feedback?.length || 1),
    avgValueRating:
      (feedback?.reduce((sum, f) => sum + (f.value_rating || 0), 0) || 0) / (feedback?.length || 1),
    recentFeedback: feedback?.slice(0, 5) || [],
  };
}

/**
 * Fetch revenue analytics
 */
async function fetchRevenueAnalytics(venueId: string) {
  const supabase = await createServerSupabaseReadOnly();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders } = await supabase
    .from("orders")
    .select("total_amount, created_at, payment_status")
    .eq("venue_id", venueId)
    .gte("created_at", thirtyDaysAgo.toISOString());

  const paidOrders = orders?.filter((o) => o.payment_status === "paid") || [];
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return {
    totalRevenue,
    totalOrders: paidOrders.length,
    avgOrderValue: totalRevenue / (paidOrders.length || 1),
    revenueByDay: groupByDay(paidOrders, "total_amount"),
  };
}

/**
 * Group array by property
 */
function groupBy<T>(array: T[], key: keyof T): Record<string, number> {
  return array.reduce(
    (acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Group by day for time series
 */
function groupByDay(array: any[], sumKey?: string): Record<string, number> {
  return array.reduce(
    (acc, item) => {
      const date = new Date(item.created_at).toISOString().split("T")[0];
      const value = sumKey ? item[sumKey] || 0 : 1;
      acc[date] = (acc[date] || 0) + value;
      return acc;
    },
    {} as Record<string, number>
  );
}
