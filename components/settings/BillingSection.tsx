"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard,
  ExternalLink,
  Crown,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeTier } from "@/lib/stripe-tier-helper";
import { useRouter } from "next/navigation";

interface BillingSectionProps {
  user?: {
    id: string;
    email: string;
  };
  organization?: {
    id: string;
    subscription_tier?: string;
    stripe_customer_id?: string;
    subscription_status?: string;
    trial_ends_at?: string;
  };
  venues?: unknown[];
  isOwner?: boolean;
  venueId?: string;
}

export default function BillingSection({ organization, venueId }: BillingSectionProps) {
  const [loadingPortal, setLoadingPortal] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Debug: Log organization data
  if (typeof window !== "undefined" && organization) {
    console.log("[BILLING DEBUG] Organization data:", {
      id: organization.id,
      subscription_tier: organization.subscription_tier,
      stripe_customer_id: organization.stripe_customer_id,
      subscription_status: organization.subscription_status,
      hasId: !!organization.id,
      fullOrg: organization,
    });
  }

  // Normalize tier: basic→starter, standard→pro, premium→enterprise
  const tierRaw = organization?.subscription_tier?.toLowerCase() || "starter";
  const tier = normalizeTier(tierRaw);
  const hasStripeCustomer = !!organization?.stripe_customer_id;
  const isGrandfathered = false; // Grandfathered accounts removed

  const handleManageBilling = async () => {
    // Debug logging
    console.log("[BILLING DEBUG] handleManageBilling called", {
      hasOrganization: !!organization,
      organizationId: organization?.id,
      organizationData: organization,
      venueId,
    });

    if (!organization?.id) {
      console.error("[BILLING DEBUG] Missing organization ID", {
        organization,
        organizationId: organization?.id,
      });
      toast({
        title: "Error",
        description: `Organization not found. Organization ID: ${organization?.id || "missing"}. Please refresh the page.`,
        variant: "destructive",
      });
      return;
    }

    setLoadingPortal(true);
    try {
      console.log("[BILLING DEBUG] Calling create-portal-session", {
        organizationId: organization.id,
        venueId,
      });
      
      const { apiClient } = await import("@/lib/api-client");
      const response = await apiClient.post("/api/stripe/create-portal-session", {
        organizationId: organization.id,
      });

      console.log("[BILLING DEBUG] Portal session response", {
        ok: response.ok,
        status: response.status,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        toast({
          title: "Error",
          description: errorData.message || errorData.error || `Failed to open billing portal (${response.status})`,
          variant: "destructive",
        });
        return;
      }

      const data = await response.json();

      if (data.error) {
        toast({
          title: "Error",
          description: data.message || data.error || "Failed to open billing portal",
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


  const getTierInfo = () => {
    if (isGrandfathered) {
      return {
        name: "Grandfathered",
        icon: Crown,
        color: "text-yellow-600",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
        description: "Legacy account with unlimited access",
      };
    }

    switch (tier) {
      case "starter":
        return {
          name: "Starter",
          icon: CreditCard,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
          description: "Essential features for small businesses",
        };
      case "pro":
        return {
          name: "Pro",
          icon: Sparkles,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
          description: "Most popular plan with advanced features",
        };
      case "enterprise":
        return {
          name: "Enterprise",
          icon: Crown,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
          borderColor: "border-purple-200",
          description: "Enterprise plan with all features",
        };
      default:
        // NO HARDCODED DEFAULT - return null for unknown/missing tiers
        return null;
    }
  };

  const tierInfo = getTierInfo();

  // Show error if no tier info (unknown or missing tier)
  if (!tierInfo) {
    return (
      <div className="space-y-6">
        <Card className="border-2 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-xl text-red-800">Unable to Load Plan Information</CardTitle>
            <CardDescription className="text-red-600">
              Could not determine your current subscription tier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Tier received:</strong> {tier || "none"} (raw: {tierRaw || "none"})
                  </div>
                  <div>
                    <strong>Organization ID:</strong> {organization?.id || "none"}
                  </div>
                  <div>
                    <strong>Has Organization:</strong> {organization ? "yes" : "no"}
                  </div>
                  <div>
                    <strong>Organization Data:</strong>{" "}
                    <pre className="text-xs mt-1 p-2 bg-gray-100 rounded overflow-auto">
                      {JSON.stringify(organization, null, 2)}
                    </pre>
                  </div>
                  <div className="mt-2">
                    Please contact support or refresh the page.
                  </div>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${tierInfo.bgColor}`}>
                <TierIcon className={`h-6 w-6 ${tierInfo.color}`} />
              </div>
              <div>
                <CardTitle className="text-xl">{tierInfo.name} Plan</CardTitle>
                <CardDescription>{tierInfo.description}</CardDescription>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {!isGrandfathered && (
                <Button
                  onClick={() => {
                    window.location.href = "/select-plan";
                  }}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Change Plan
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Billing Management */}
      {hasStripeCustomer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing Management
            </CardTitle>
            <CardDescription>
              Manage your subscription, payment methods, and billing history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {organization?.subscription_status && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Subscription Status</span>
                  <Badge
                    variant={
                      organization.subscription_status === "active" ? "default" : "secondary"
                    }
                    className={organization.subscription_status === "active" ? "bg-green-600" : ""}
                  >
                    {organization.subscription_status}
                  </Badge>
                </div>
              )}

              {organization?.trial_ends_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {new Date(organization.trial_ends_at) > new Date()
                      ? "Trial Ends"
                      : "Trial Ended"}
                  </span>
                  <span className="text-sm text-gray-600">
                    {new Date(organization.trial_ends_at).toLocaleDateString()}
                  </span>
                </div>
              )}

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
                    Open Billing Portal
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-600 text-center">
                Manage your subscription, update payment methods, and view billing history.
                Your tier is automatically synced from Stripe when you make changes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Billing Account */}
      {!isGrandfathered && !hasStripeCustomer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Billing Account
            </CardTitle>
            <CardDescription>Set up billing to manage your subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                No billing account found. Contact support to set up billing management.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

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
              enabled={tier === "enterprise" || isGrandfathered}
              tier="enterprise"
            />
            <FeatureItem
              name="Inventory Management"
              enabled={tier === "pro" || tier === "enterprise" || isGrandfathered}
              tier="pro"
            />
            <FeatureItem
              name="AI Assistant"
              enabled={tier === "enterprise" || isGrandfathered}
              tier="enterprise"
            />
            <FeatureItem
              name="Multi-Venue Management"
              enabled={tier === "enterprise" || isGrandfathered}
              tier="enterprise"
            />
            <FeatureItem
              name="Advanced Analytics"
              enabled={tier === "pro" || tier === "enterprise" || isGrandfathered}
              tier="pro"
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
