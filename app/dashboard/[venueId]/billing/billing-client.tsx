"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CreditCard, 
  Sparkles, 
  TrendingUp, 
  Users, 
  UtensilsCrossed, 
  Building2,
  Crown,
  ExternalLink,
  CheckCircle
} from "lucide-react";
import { UpgradeModal } from "@/components/upgrade-modal";
import { formatDistanceToNow } from "date-fns";

interface BillingClientProps {
  venueId: string;
  venueName: string;
  organization: any;
  usage: {
    menuItems: number;
    tables: number;
    staff: number;
    venues: number;
  };
}

const TIER_INFO = {
  grandfathered: {
    name: "Grandfathered",
    icon: Crown,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  basic: {
    name: "Basic",
    icon: Building2,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  },
  standard: {
    name: "Standard",
    icon: TrendingUp,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  premium: {
    name: "Premium",
    icon: Sparkles,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
};

const TIER_LIMITS = {
  basic: { menuItems: 50, tables: 10, staff: 3, venues: 1 },
  standard: { menuItems: 200, tables: 20, staff: 10, venues: 1 },
  premium: { menuItems: -1, tables: -1, staff: -1, venues: -1 },
  grandfathered: { menuItems: -1, tables: -1, staff: -1, venues: -1 },
};

export default function BillingClient({
  venueId,
  venueName,
  organization,
  usage,
}: BillingClientProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const tier = organization?.subscription_tier || "basic";
  const isGrandfathered = organization?.is_grandfathered || false;
  const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.basic;
  const tierInfo = TIER_INFO[tier as keyof typeof TIER_INFO] || TIER_INFO.basic;
  const TierIcon = tierInfo.icon;

  const handleManageBilling = async () => {
    setLoadingPortal(true);
    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organization?.id }),
      });

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
    } finally {
      setLoadingPortal(false);
    }
  };

  const getUsagePercent = (current: number, max: number) => {
    if (max === -1) return 0; // Unlimited
    return Math.min((current / max) * 100, 100);
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return "text-red-600";
    if (percent >= 70) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card className={`border-2 ${tierInfo.borderColor} ${tierInfo.bgColor}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${tierInfo.bgColor}`}>
                <TierIcon className={`h-6 w-6 ${tierInfo.color}`} />
              </div>
              <div>
                <CardTitle className="text-2xl">{tierInfo.name} Plan</CardTitle>
                <CardDescription>
                  {isGrandfathered ? (
                    <span className="flex items-center gap-2 text-yellow-700">
                      <Crown className="h-4 w-4" />
                      Legacy account with unlimited access
                    </span>
                  ) : (
                    `Your current subscription tier`
                  )}
                </CardDescription>
              </div>
            </div>

            <div className="flex gap-2">
              {!isGrandfathered && tier !== "premium" && (
                <Button onClick={() => setShowUpgradeModal(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upgrade Plan
                </Button>
              )}
              
              {!isGrandfathered && organization?.stripe_customer_id && (
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={loadingPortal}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Billing
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {isGrandfathered && (
          <CardContent>
            <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-yellow-700 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                    Thank you for being an early Servio user!
                  </p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    Your account has been grandfathered with unlimited access to all features at no charge.
                    This includes AI Assistant, multi-venue support, and all premium capabilities.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Usage Statistics */}
      {!isGrandfathered && (
        <Card>
          <CardHeader>
            <CardTitle>Usage & Limits</CardTitle>
            <CardDescription>
              Track your usage against your plan limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Menu Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Menu Items</span>
                </div>
                <span className={`text-sm font-semibold ${getUsageColor(getUsagePercent(usage.menuItems, limits.menuItems))}`}>
                  {usage.menuItems} {limits.menuItems === -1 ? "" : `/ ${limits.menuItems}`}
                </span>
              </div>
              {limits.menuItems !== -1 && (
                <Progress value={getUsagePercent(usage.menuItems, limits.menuItems)} />
              )}
            </div>

            {/* Tables */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Tables</span>
                </div>
                <span className={`text-sm font-semibold ${getUsageColor(getUsagePercent(usage.tables, limits.tables))}`}>
                  {usage.tables} {limits.tables === -1 ? "" : `/ ${limits.tables}`}
                </span>
              </div>
              {limits.tables !== -1 && (
                <Progress value={getUsagePercent(usage.tables, limits.tables)} />
              )}
            </div>

            {/* Staff */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Staff Members</span>
                </div>
                <span className={`text-sm font-semibold ${getUsageColor(getUsagePercent(usage.staff, limits.staff))}`}>
                  {usage.staff} {limits.staff === -1 ? "" : `/ ${limits.staff}`}
                </span>
              </div>
              {limits.staff !== -1 && (
                <Progress value={getUsagePercent(usage.staff, limits.staff)} />
              )}
            </div>

            {/* Venues */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Venues</span>
                </div>
                <span className={`text-sm font-semibold ${getUsageColor(getUsagePercent(usage.venues, limits.venues))}`}>
                  {usage.venues} {limits.venues === -1 ? "" : `/ ${limits.venues}`}
                </span>
              </div>
              {limits.venues !== -1 && (
                <Progress value={getUsagePercent(usage.venues, limits.venues)} />
              )}
            </div>

            {/* Upgrade prompt if approaching limits */}
            {(getUsagePercent(usage.menuItems, limits.menuItems) > 80 ||
              getUsagePercent(usage.tables, limits.tables) > 80) && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ You're approaching your plan limits. Consider upgrading to avoid interruptions.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  View Upgrade Options
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Subscription Details */}
      {!isGrandfathered && organization?.stripe_subscription_id && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription Details</CardTitle>
            <CardDescription>Manage your billing and subscription</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={organization.subscription_status === "active" ? "default" : "secondary"}>
                  {organization.subscription_status}
                </Badge>
              </div>
              
              {organization.trial_ends_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Trial Ends</p>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(organization.trial_ends_at), { addSuffix: true })}
                  </p>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleManageBilling}
              disabled={loadingPortal}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Billing Portal
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Feature Access */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Access</CardTitle>
          <CardDescription>
            Features available on your {tierInfo.name} plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureItem
              name="QR Ordering"
              enabled={true}
              tier="all"
            />
            <FeatureItem
              name="Kitchen Display System"
              enabled={tier === "standard" || tier === "premium" || isGrandfathered}
              tier="standard"
            />
            <FeatureItem
              name="Inventory Management"
              enabled={tier === "standard" || tier === "premium" || isGrandfathered}
              tier="standard"
            />
            <FeatureItem
              name="AI Assistant"
              enabled={tier === "premium" || isGrandfathered}
              tier="premium"
            />
            <FeatureItem
              name="Multi-Venue Management"
              enabled={tier === "premium" || isGrandfathered}
              tier="premium"
            />
            <FeatureItem
              name="Advanced Analytics"
              enabled={tier === "standard" || tier === "premium" || isGrandfathered}
              tier="standard"
            />
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        currentTier={tier}
        organizationId={organization?.id}
      />
    </div>
  );
}

function FeatureItem({
  name,
  enabled,
  tier,
}: {
  name: string;
  enabled: boolean;
  tier: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <span className="text-sm font-medium">{name}</span>
      {enabled ? (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Enabled
        </Badge>
      ) : (
        <Badge variant="outline">
          {tier === "premium" ? "Premium" : tier === "standard" ? "Standard" : "Basic"}
        </Badge>
      )}
    </div>
  );
}

