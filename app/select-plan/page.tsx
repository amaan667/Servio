"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
import { supabaseBrowser } from "@/lib/supabase";
import { useAuth } from "@/app/auth/AuthProvider";
import { PRICING_TIERS } from "@/lib/pricing-tiers";

export default function SelectPlanPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [currentTier, setCurrentTier] = useState<string | null>(null);

  // Check if user already has venues and get their current plan
  useEffect(() => {
    const checkExistingVenues = async () => {
      if (authLoading) return; // Wait for auth to load

      if (!session?.user) {
        // Not signed in - this is fine, they can view plans
        setIsChecking(false);
        return;
      }

      try {
        const supabase = supabaseBrowser();

        // Check for owner venues first
        const { data: ownerVenues, error: venueError } = await supabase
          .from("venues")
          .select("venue_id, organization_id")
          .eq("owner_user_id", session.user.id)
          .limit(1)
          .maybeSingle();

        console.log("[SELECT-PLAN] Checking owner venues", {
          hasOwnerVenues: !!ownerVenues,
          venueId: ownerVenues?.venue_id,
          organizationId: ownerVenues?.organization_id,
          error: venueError?.message,
        });

        if (ownerVenues && ownerVenues.venue_id) {
          // User has owner venues - redirect to dashboard (they already have an owner account)
          console.log("[SELECT-PLAN] User has owner venues, redirecting to dashboard", {
            venueId: ownerVenues.venue_id,
          });
          router.push(`/dashboard/${ownerVenues.venue_id}`);
          return;
        }

        // Check if user has staff roles but no owner venues
        const { data: staffRoles, error: staffError } = await supabase
          .from("user_venue_roles")
          .select("venue_id, role")
          .eq("user_id", session.user.id)
          .limit(1)
          .maybeSingle();

        console.log("[SELECT-PLAN] Checking staff roles", {
          hasStaffRoles: !!staffRoles,
          venueId: staffRoles?.venue_id,
          role: staffRoles?.role,
          error: staffError?.message,
        });

        if (staffRoles && staffRoles.venue_id && !ownerVenues) {
          // User has staff roles but no owner venues - they're a staff member only
          // Redirect them to their staff dashboard instead of allowing owner account creation
          console.log("[SELECT-PLAN] User is staff-only, redirecting to staff dashboard", {
            venueId: staffRoles.venue_id,
            role: staffRoles.role,
          });
          router.push(`/dashboard/${staffRoles.venue_id}`);
          return;
        }

        // User is signed in but has no owner venues - get their current plan if they have an organization
        if (ownerVenues?.organization_id) {
          const { data: organization, error: orgError } = await supabase
            .from("organizations")
            .select("subscription_tier")
            .eq("id", ownerVenues.organization_id)
            .maybeSingle();

          console.log("[SELECT-PLAN] Organization query", {
            hasOrg: !!organization,
            tier: organization?.subscription_tier,
            error: orgError?.message,
          });

          if (organization?.subscription_tier) {
            // Normalize tier name
            const tier = organization.subscription_tier.toLowerCase();
            const normalizedTier =
              tier === "premium"
                ? "enterprise"
                : tier === "standard" || tier === "professional"
                  ? "pro"
                  : tier === "basic"
                    ? "starter"
                    : tier;
            setCurrentTier(normalizedTier);
          }
        } else {
          // Try to get organization directly
          const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("subscription_tier")
            .eq("owner_user_id", session.user.id)
            .maybeSingle();

          console.log("[SELECT-PLAN] Direct organization query", {
            hasOrg: !!org,
            tier: org?.subscription_tier,
            error: orgError?.message,
          });

          if (org?.subscription_tier) {
            const tier = org.subscription_tier.toLowerCase();
            const normalizedTier =
              tier === "premium"
                ? "enterprise"
                : tier === "standard" || tier === "professional"
                  ? "pro"
                  : tier === "basic"
                    ? "starter"
                    : tier;
            setCurrentTier(normalizedTier);
          }
        }

        // User is signed in - show plan selection with current plan highlighted
        setIsChecking(false);
      } catch (error) {
        console.error("[SELECT-PLAN] Error checking venues:", error);
        setIsChecking(false);
      }
    };

    checkExistingVenues();
  }, [session, authLoading, router]);

  // Get CTA button text based on current tier
  const getPlanCTA = (planTier: string) => {
    if (!currentTier) {
      return "Start Free Trial";
    }

    if (currentTier === planTier) {
      return "Current Plan";
    }

    const tierOrder = { starter: 1, pro: 2, enterprise: 3 };
    const currentLevel = tierOrder[currentTier as keyof typeof tierOrder] || 0;
    const planLevel = tierOrder[planTier as keyof typeof tierOrder] || 0;

    if (planLevel > currentLevel) {
      return "Upgrade";
    } else if (planLevel < currentLevel) {
      return `Downgrade to ${PRICING_TIERS[planTier]?.name}`;
    }

    return "Select Plan";
  };

  // Use shared pricing configuration
  const pricingPlans = Object.entries(PRICING_TIERS).map(([tierKey, tierData]) => ({
    name: tierData.name,
    price: tierData.price,
    period: "month",
    tier: tierKey,
    description: tierData.description,
    features: tierData.features,
    notIncluded: [] as string[], // Can be customized if needed
    popular: tierData.popular || false,
  }));

  const handleSelectPlan = async (tier: string) => {
    setLoading(true);
    setSelectedTier(tier);

    try {
      // Get pending email from sessionStorage (from Google OAuth)
      const pendingEmail =
        typeof window !== "undefined" ? sessionStorage.getItem("pending_signup_email") : null;

      // Create Stripe checkout session
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          email: pendingEmail || "",
          isSignup: true,
        }),
      });

      const data = await response.json();

      if (data.error || !data.url) {
        alert(data.error || "Failed to create checkout session. Please try again.");
        setLoading(false);
        setSelectedTier(null);
        return;
      }

      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to proceed. Please try again.");
      setLoading(false);
      setSelectedTier(null);
    }
  };

  // Show loading state while checking
  if (isChecking || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <NavigationBreadcrumb showBackButton={false} />

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
          <p className="text-xl text-gray-700">
            Start your 14-day free trial. No credit card required until trial ends.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan) => (
            <Card
              key={plan.tier}
              className={`border-2 shadow-lg relative ${plan.popular ? "border-purple-500" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-purple-600 text-white px-4 py-1">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-bold text-gray-900">{plan.price}</span>
                  {plan.period && <span className="text-gray-700 ml-2">/{plan.period}</span>}
                </div>
                <CardDescription className="mt-4">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((feature, idx) => (
                    <li key={idx} className="flex items-start opacity-50">
                      <X className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => {
                    handleSelectPlan(plan.tier);
                  }}
                  disabled={(loading && selectedTier !== plan.tier) || currentTier === plan.tier}
                  className={`w-full font-semibold ${
                    plan.popular
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "border-2 border-purple-600 text-purple-600 hover:bg-purple-50 bg-white"
                  }`}
                  variant={plan.popular ? "default" : "outline"}
                  size="lg"
                >
                  {loading && selectedTier === plan.tier ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    getPlanCTA(plan.tier)
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center text-gray-600">
          <p>All plans include a 14-day free trial. Cancel anytime.</p>
        </div>
      </div>
    </div>
  );
}
