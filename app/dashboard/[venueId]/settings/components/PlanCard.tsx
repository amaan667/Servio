"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Check, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

import { PRICING_TIERS } from "@/lib/pricing-tiers";
import { useToast } from "@/hooks/use-toast";

interface PlanCardProps {
  organization?: {
    id: string;
    subscription_tier?: string;
    stripe_customer_id?: string;
  };
  venueId?: string;
}

export function PlanCard({ organization, venueId }: PlanCardProps) {
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [currentTier, setCurrentTier] = useState(organization?.subscription_tier);
  const { toast } = useToast();

  const hasStripeCustomer = !!organization?.stripe_customer_id;

  // Use tier directly from database (should match Stripe exactly)
  const normalizedTier = currentTier?.toLowerCase().trim() as
    | "starter"
    | "pro"
    | "enterprise"
    | undefined;
  const tierInfo = normalizedTier ? PRICING_TIERS[normalizedTier] : null;
  const planName = tierInfo?.name;
  const features = tierInfo?.features;

  // Sync plan from Stripe on mount
  useEffect(() => {
    if (organization?.id && hasStripeCustomer) {
      syncPlanFromStripe();
    }
  }, [organization?.id, hasStripeCustomer]);

  const syncPlanFromStripe = async () => {
    if (!organization?.id) {
      return;
    }

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
      /* Error handled silently */
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
        toast({
          title: "Error",
          description: `Failed to open billing portal: ${data.error}`,
          variant: "destructive",
        });
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: "Failed to open billing portal - no URL received",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingPortal(false);
    }
  };

  // Show error state if no organization data
  if (!organization) {
    return (
      <Card className="shadow-lg rounded-xl border-gray-200">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-t-xl">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Crown className="h-5 w-5 text-amber-600" />
            Current Plan
          </CardTitle>
          <CardDescription>Unable to load subscription information</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Unable to load your subscription information. Please refresh the page or contact
              support.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading state while syncing
  if (syncing) {
    return (
      <Card className="shadow-lg rounded-xl border-gray-200">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-t-xl">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Crown className="h-5 w-5 text-amber-600" />
            Current Plan
          </CardTitle>
          <CardDescription>Syncing subscription information...</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </CardContent>
      </Card>
    );
  }

  // Show error if tier info not found
  if (!tierInfo || !planName || !features) {
    return (
      <Card className="shadow-lg rounded-xl border-gray-200">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-t-xl">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Crown className="h-5 w-5 text-amber-600" />
            Current Plan
          </CardTitle>
          <CardDescription>Subscription information</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              Unable to determine your current plan. Tier received: {currentTier || "none"}
              {currentTier && currentTier !== normalizedTier && (
                <span className="ml-2 text-xs text-gray-600">
                  (normalized to: {normalizedTier})
                </span>
              )}
            </p>
            <p className="text-xs text-red-600 mt-2">Organization ID: {organization.id}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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

        {/* Billing Portal Link - Handles plan changes, payment methods, invoices */}
        {hasStripeCustomer && (
          <>
            <Button
              variant="default"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
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
                  <Crown className="mr-2 h-4 w-4" />
                  Manage Billing & Plan
                </>
              )}
            </Button>
            <p className="text-xs text-gray-600 text-center">
              Upgrade, downgrade, update payment method, and view invoices
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
