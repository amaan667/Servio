"use client";

import PaymentsClient from "./PaymentsClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import type { UserRole } from "@/lib/permissions";

interface PaymentTransaction {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  table_label: string | null;
  counter_label: string | null;
  total_amount: number;
  payment_status: string;
  payment_method: string | null;
  order_status: string;
  created_at: string;
  refunded_at: string | null;
  refund_amount: number | null;
  refund_reason: string | null;
}

interface PaymentStats {
  todayRevenue: number;
  pendingPayments: number;
  completedPayments: number;
  refundTotal: number;
  unpaidOrdersCount: number;
  paidOrdersCount: number;
}

export default function PaymentsClientPage({
  venueId,
  role,
  initialTransactions,
  initialStats,
}: {
  venueId: string;
  tier: string;
  role: string;
  initialTransactions?: PaymentTransaction[];
  initialStats?: PaymentStats;
}) {
  const { user } = useAuthRedirect();
  const userRole = role as UserRole;

  // Don't show loading spinner - just render when ready

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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Payments</h1>
          <p className="text-lg text-foreground mt-2">
            Manage payments, split bills, and view receipts
          </p>
        </div>

        <PaymentsClient
          venueId={venueId}
          initialTransactions={initialTransactions}
          initialStats={initialStats}
        />
      </div>
    </div>
  );
}
