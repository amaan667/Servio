"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, Crown, Sparkles, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TIER_LIMITS } from "@/lib/tier-limits";

interface BillingSectionProps {
  user?: {

  };
  organization?: {

  };
  venues?: unknown[];
  isOwner?: boolean;
  venueId?: string;
}

export default function BillingSection({ organization }: BillingSectionProps) {
  const [loadingChangePlan, setLoadingChangePlan] = useState(false);
  const { toast } = useToast();

  // Show loading state if organization data is not available yet
  if (!organization) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Billing & Subscription</CardTitle>
            <CardDescription>Loading plan information...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading subscription details...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get tier from organization - should match Stripe exactly (no normalization)
  const tier = (organization?.subscription_tier?.toLowerCase() || "starter") as
    | "starter"
    | "pro"
    | "enterprise";
  const hasStripeCustomer = !!organization?.stripe_customer_id;
  const isGrandfathered = false; // Grandfathered accounts removed

  // Helper to get feature enabled status from TIER_LIMITS
  const getFeatureEnabled = (feature: string, currentTier: string): boolean => {
    const tierLimits = TIER_LIMITS[currentTier as keyof typeof TIER_LIMITS];
    if (!tierLimits) return false;

    // Map feature names to TIER_LIMITS keys
    const featureMap: Record<string, keyof typeof tierLimits.features> = {

    };

    const featureKey = featureMap[feature];
    if (!featureKey) return false;

    const featureValue = tierLimits.features[featureKey];

    // For boolean features, return the value directly
    if (typeof featureValue === "boolean") {
      return featureValue;
    }

    // For analytics, any non-basic value means enabled (advanced, advanced+exports)
    if (feature === "analytics" && typeof featureValue === "string") {
      return featureValue !== "basic";
    }

    return false;
  };

  const handleChangePlan = async () => {
    if (!organization?.id) {
      toast({

      return;
    }

    setLoadingChangePlan(true);
    try {
      // Sync tier from Stripe before opening portal to ensure consistency
      try {
        const { apiClient } = await import("@/lib/api-client");
        await apiClient.post("/api/subscription/refresh-status", {

      } catch (syncError) {
        // Non-critical - continue even if sync fails
        
      }

      // Open Stripe billing portal where users can upgrade/downgrade
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.post("/api/stripe/create-portal-session", {

      const data = await response.json();

      if (!response.ok) {
        toast({

          description:
            data.message || data.error || `Failed to open billing portal (${response.status})`,

        return;
      }

      if (data.error) {
        toast({

        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({

      }
    } catch (error) {
      toast({

    } finally {
      setLoadingChangePlan(false);
    }
  };

  const getTierInfo = () => {
    if (isGrandfathered) {
      return {

      };
    }

    switch (tier) {
      case "starter":
        return {

        };
      case "pro":
        return {

        };
      case "enterprise":
        return {

        };

    }
  };

  const tierInfo = getTierInfo();

  // Show error only for truly invalid tiers (shouldn't happen with proper data)
  if (!tierInfo) {
    return (
      <div className="space-y-6">
        <Card className="border-2 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-xl text-red-800">Invalid Subscription Tier</CardTitle>
            <CardDescription className="text-red-600">
              Your subscription tier could not be recognized.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Invalid tier:</strong> {tier}
                  </div>
                  <div>Please contact support to resolve this issue.</div>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const TierIcon = tierInfo.icon;

  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      <Card className={`border-2 ${tierInfo.borderColor} ${tierInfo.bgColor}`}>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${tierInfo.bgColor}`}>
                <TierIcon className={`h-6 w-6 ${tierInfo.color}`} />
              </div>
              <div>
                <CardTitle className="text-xl">{tierInfo.name} Plan</CardTitle>
                <CardDescription>{tierInfo.description}</CardDescription>
              </div>
            </div>

            {organization?.subscription_status && (
              <Badge
                variant={organization.subscription_status === "active" ? "default" : "secondary"}
                className={organization.subscription_status === "active" ? "bg-green-600" : ""}
              >
                {organization.subscription_status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {organization?.trial_ends_at && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">
                  {new Date(organization.trial_ends_at) > new Date() ? "Trial Ends" : "Trial Ended"}
                </span>
                <span className="text-sm text-gray-600">
                  {new Date(organization.trial_ends_at).toLocaleDateString()}
                </span>
              </div>
            )}

            {!isGrandfathered && (
              <Button
                onClick={handleChangePlan}
                disabled={loadingChangePlan}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              >
                {loadingChangePlan ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Change Plan
                  </>
                )}
              </Button>
            )}

            {hasStripeCustomer && (
              <p className="text-xs text-gray-600 text-center">
                Click "Change Plan" to upgrade, downgrade, or manage your subscription, payment
                methods, and billing history.
              </p>
            )}

            {!hasStripeCustomer && !isGrandfathered && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  No billing account found. Contact support to set up billing management.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feature Access Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Features</CardTitle>
          <CardDescription>Features available on your {tierInfo.name} plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FeatureItem name="QR Ordering" enabled={true} tier="all" />
            <FeatureItem
              name="Kitchen Display System"
              enabled={getFeatureEnabled("kds", tier)}
              tier="enterprise"
            />
            <FeatureItem
              name="Inventory Management"
              enabled={getFeatureEnabled("inventory", tier)}
              tier="pro"
            />
            <FeatureItem
              name="AI Assistant"
              enabled={getFeatureEnabled("aiAssistant", tier)}
              tier="enterprise"
            />
            <FeatureItem
              name="Multi-Venue Management"
              enabled={getFeatureEnabled("multiVenue", tier)}
              tier="enterprise"
            />
            <FeatureItem
              name="Advanced Analytics"
              enabled={getFeatureEnabled("analytics", tier)}
              tier="pro"
            />
            <FeatureItem
              name="Customer Feedback"
              enabled={getFeatureEnabled("customerFeedback", tier)}
              tier="pro"
            />
            <FeatureItem
              name="Custom Branding"
              enabled={getFeatureEnabled("customBranding", tier)}
              tier="enterprise"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureItem({ name, enabled, tier }: { name: string; enabled: boolean; tier: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <span className="text-sm font-medium">{name}</span>
      {enabled ? (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Enabled
        </Badge>
      ) : (
        <Badge variant="outline">
          {tier === "enterprise" ? "Enterprise" : tier === "pro" ? "Pro" : "Starter"}
        </Badge>
      )}
    </div>
  );
}
