"use client";

import OrdersClient from "./OrdersClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import type { UserRole } from "@/lib/permissions";

interface OrdersClientPageProps {
  venueId: string;
  tier: string;
  role: string;
  initialOrders?: Array<{
    id: string;
    venue_id: string;
    table_number: number | null;
    table_id?: string | null;
    session_id?: string | null;
    customer_name: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    items: Array<{
      menu_item_id: string;
      item_name: string;
      quantity: number;
      price: number;
      specialInstructions?: string;
    }>;
    total_amount: number;
    created_at: string;
    updated_at?: string;
    order_status:
      | "PLACED"
      | "ACCEPTED"
      | "IN_PREP"
      | "READY"
      | "OUT_FOR_DELIVERY"
      | "SERVING"
      | "COMPLETED"
      | "CANCELLED"
      | "REFUNDED"
      | "EXPIRED";
    payment_status?: string;
    payment_method?: string;
    notes?: string;
    scheduled_for?: string;
    prep_lead_minutes?: number;
    source?: "qr" | "counter";
    table_label?: string;
    counter_label?: string;
    table?: { is_configured: boolean } | null;
  }>;
  initialStats?: {
    todayOrders: number;
    revenue: number;
  };
}

export default function OrdersClientPage({
  venueId,
  tier: _tier,
  role,
  initialOrders,
  initialStats,
}: OrdersClientPageProps) {
  const { user } = useAuthRedirect();
  const userRole = role as UserRole;

  // Render immediately - no blocking

  // Don't render if no user (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {user && userRole && (
          <RoleBasedNavigation
            venueId={venueId}
            userRole={userRole}
            userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "User"}
          />
        )}

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Order Management</h1>
          <p className="text-lg text-foreground mt-2">View and manage all orders</p>
        </div>

        <OrdersClient venueId={venueId} initialOrders={initialOrders} initialStats={initialStats} />
      </div>
    </div>
  );
}
