import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Check, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";

interface PlanCardProps {
  organization?: {
    id: string;
    subscription_tier?: string;
    stripe_customer_id?: string;
  };
  venueId?: string;
}

const PLAN_FEATURES = {
  basic: [
    "Up to 50 orders per month",
    "Basic menu management",
    "QR code ordering",
    "Email support",
  ],
  standard: [
    "Up to 500 orders per month",
    "Advanced menu management",
    "QR code ordering",
    "Table management",
    "Basic analytics",
    "Priority email support",
  ],
  premium: [
    "Unlimited orders",
    "Advanced menu management",
    "QR code ordering",
    "Full table management",
    "Advanced analytics & insights",
    "Inventory tracking",
    "Staff management",
    "Priority support (24/7)",
    "Custom branding",
  ],
};

export function PlanCard({ organization, venueId }: PlanCardProps) {
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [currentTier, setCurrentTier] = useState(organization?.subscription_tier || "basic");

  const hasStripeCustomer = !!organization?.stripe_customer_id;

  // Capitalize tier name
  const planName = currentTier.charAt(0).toUpperCase() + currentTier.slice(1);
  const features = PLAN_FEATURES[currentTier as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.basic;

  // Sync plan from Stripe on mount
  useEffect(() => {
    if (organization?.id && hasStripeCustomer) {
      syncPlanFromStripe();
    }
  }, [organization?.id, hasStripeCustomer]);

  const syncPlanFromStripe = async () => {
    if (!organization?.id) return;

    setSyncing(true);
    try {
      const response = await fetch("/api/subscription/sync-from-stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organization.id }),
      });

      const data = await response.json();

      if (data.synced && data.newTier) {
        setCurrentTier(data.newTier);
      } else if (data.tier) {
        setCurrentTier(data.tier);
      }
    } catch (error) {
      logger.error("[PLAN CARD] Sync failed", { error });
    } finally {
      setSyncing(false);
    }
  };

  const handleManageBilling = async () => {
    setLoadingPortal(true);
    try {
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.post("/api/stripe/create-portal-session", {
        organizationId: organization?.id,
        venueId: venueId,
      });

      const data = await response.json();

      if (data.error) {
        alert(`Failed to open billing portal: ${data.error}`);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Failed to open billing portal - no URL received");
      }
    } catch {
      alert("Failed to open billing portal. Please try again.");
    } finally {
      setLoadingPortal(false);
    }
  };

  return (
    <Card className="shadow-lg rounded-xl border-gray-200">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <Crown className="h-5 w-5 text-amber-600" />
          Current Plan
        </CardTitle>
        <CardDescription>Your subscription and features</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Plan Name */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-100">
          <p className="text-sm text-gray-600 mb-1">You are on the</p>
          <p className="text-2xl font-bold text-purple-600">{planName} Plan</p>
        </div>

        {/* Features */}
        <div>
          <p className="text-sm font-medium text-gray-900 mb-3">Plan Features:</p>
          <div className="space-y-2">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Billing Portal Link */}
        {hasStripeCustomer && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleManageBilling}
            disabled={loadingPortal}
          >
            {loadingPortal ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage Billing
              </>
            )}
          </Button>
        )}

        {hasStripeCustomer && (
          <p className="text-xs text-gray-600 text-center">
            Update payment method, view invoices, and manage your subscription
          </p>
        )}
      </CardContent>
    </Card>
  );
}
