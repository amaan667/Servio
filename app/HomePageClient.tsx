"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { HeroSection } from "./components/HeroSection";
import { FeaturesSection } from "./components/FeaturesSection";
import { TestimonialsSection } from "./components/TestimonialsSection";
import { CTASection } from "./components/CTASection";
import { Footer } from "./components/Footer";
import { supabaseBrowser } from "@/lib/supabase";
import { PRICING_TIERS } from "@/lib/pricing-tiers";
import { cn } from "@/lib/utils";

// FAQ Item Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl bg-servio-purple shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-servio-purple group">
      {/* Question Button - follows hover logic */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 text-left flex justify-between items-center gap-4 focus:outline-none bg-servio-purple hover:bg-white transition-all duration-200 rounded-t-xl"
      >
        <h3 className="font-semibold text-base md:text-lg text-white group-hover:text-servio-purple transition-colors duration-200">
          {question}
        </h3>
        <div className="ml-4 flex-shrink-0">
          {isOpen ? (
            <ChevronUp className="h-5 w-5 text-white group-hover:text-servio-purple transition-all duration-200 ease-out" />
          ) : (
            <ChevronDown className="h-5 w-5 text-white group-hover:text-servio-purple transition-all duration-200 ease-out" />
          )}
        </div>
      </button>
      {/* Answer - always white on purple, no hover */}
      {isOpen && (
        <div className="px-5 pt-3 pb-4 border-t border-purple-500/30 bg-servio-purple rounded-b-xl">
          <p className="text-white leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

interface HomePageClientProps {

}

export function HomePageClient({ initialAuthState, initialUserPlan = null }: HomePageClientProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Use server-provided auth state and plan - prevents flicker
  const [isSignedIn, setIsSignedIn] = useState(initialAuthState);
  const [userPlan, setUserPlan] = useState<"starter" | "pro" | "enterprise" | null>(
    initialUserPlan
  );
  const [loadingPlan, setLoadingPlan] = useState(false);

  // Sync with auth context when it updates (but only if different)
  useEffect(() => {
    const currentAuthState = !!user;
    if (currentAuthState !== isSignedIn) {
      setIsSignedIn(currentAuthState);

      // If user logged out, reset plan
      if (!currentAuthState) {
        setUserPlan(null);
      }
    }
  }, [user, isSignedIn]);

  // Fetch user plan from client if not provided by server
  useEffect(() => {
    const fetchUserPlan = async () => {
      // Only fetch if:
      // 1. User is signed in
      // 2. We don't already have a plan from server (initialUserPlan is null)
      // 3. We haven't already fetched it (userPlan is null)
      if (isSignedIn && user && !userPlan && initialUserPlan === null) {
        try {
          const supabase = supabaseBrowser();

          // Try to get organization_id from venues first
          const { data: venues, error: venueError } = await supabase
            .from("venues")
            .select("organization_id")
            .eq("owner_user_id", user.id)
            .limit(1)
            .maybeSingle();

          let organizationId = venues?.organization_id;

          // If venue query fails or no organization_id, query organizations table directly
          if (!organizationId || venueError) {
            const { data: org } = await supabase
              .from("organizations")
              .select("id, subscription_tier")
              .eq("owner_user_id", user.id)
              .maybeSingle();

            if (org?.subscription_tier) {
              organizationId = org.id;
              // Normalize old tier names to new ones
              const tier = org.subscription_tier.toLowerCase();
              const normalizedTier =
                tier === "premium"
                  ? "enterprise"

            }
          } else if (organizationId) {
            // Got organization_id from venue, fetch tier
            const { data: org } = await supabase
              .from("organizations")
              .select("subscription_tier")
              .eq("id", organizationId)
              .maybeSingle();

            if (org?.subscription_tier) {
              // Normalize old tier names to new ones
              const tier = org.subscription_tier.toLowerCase();
              const normalizedTier =
                tier === "premium"
                  ? "enterprise"

            }
          }
        } catch {
          // Error fetching plan - ignore silently
        }
      }
    };

    fetchUserPlan();
  }, [isSignedIn, user, userPlan, initialUserPlan]);

  // Clean up URL params on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("cancelled") || url.searchParams.has("upgrade")) {
        // Remove cancelled/upgrade params from URL without reload
        url.searchParams.delete("cancelled");
        url.searchParams.delete("upgrade");
        window.history.replaceState({}, document.title, url.toString());
      }
    }
  }, []);

  const handleGetStarted = async () => {
    if (isSignedIn && user) {
      // Get user's first venue (owner or staff)
      const supabase = supabaseBrowser();

      // First check for owner venues
      const { data: ownerVenues } = await supabase
        .from("venues")
        .select("venue_id")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true }) // ✅ Get FIRST venue (oldest)
        .limit(1)
        .maybeSingle();

      if (ownerVenues && ownerVenues.venue_id) {
        router.push(`/dashboard/${ownerVenues.venue_id}`);
        return;
      }

      // Check for staff roles
      const { data: staffRoles } = await supabase
        .from("user_venue_roles")
        .select("venue_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (staffRoles && staffRoles.venue_id) {
        // User has staff roles → redirect to staff dashboard
        router.push(`/dashboard/${staffRoles.venue_id}`);
        return;
      }

      // User signed in but no venues → redirect to plan page
      router.push("/select-plan");
    } else {
      router.push("/select-plan");
    }
  };

  const handlePlanAction = async (ctaText: string) => {
    // If current plan or loading, do nothing
    if (ctaText === "Current Plan" || ctaText === "Loading...") {
      return;
    }

    // If Contact Sales, open mailto
    if (ctaText === "Contact Sales") {
      window.location.href = "mailto:support@servio.app?subject=Enterprise Plan Inquiry";
      return;
    }

    // For upgrades/downgrades
    if (isSignedIn && user) {
      setLoadingPlan(true);
      try {
        const supabase = supabaseBrowser();

        // First try to get venue with organization_id
        const { data: venues } = await supabase
          .from("venues")
          .select("venue_id, organization_id")
          .eq("owner_user_id", user.id)
          .limit(1)
          .maybeSingle();

        let organizationId = venues?.organization_id;

        // If no organization_id from venue, try to get it directly from organizations table
        if (!organizationId) {
          const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("id")
            .eq("owner_user_id", user.id)
            .maybeSingle();

          if (org?.id) {
            organizationId = org.id;
          } else if (orgError) {
            alert(`Error fetching organization: ${orgError.message}`);
            setLoadingPlan(false);
            return;
          }
        }

        if (!organizationId) {
          // No organization found - user needs to sign up first
          router.push("/select-plan");
          setLoadingPlan(false);
          return;
        }

        // Verify we have a valid session first
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          // NO REDIRECTS - User requested ZERO sign-in redirects
          alert("Session expired. Please sign in again.");
          setLoadingPlan(false);
          return;
        }

        const { apiClient } = await import("@/lib/api-client");

        // Handle downgrades - redirect to Stripe portal
        if (ctaText.includes("Downgrade")) {
          // Open Stripe portal where users can manage/downgrade their plan
          const response = await apiClient.post("/api/stripe/create-portal-session", {

          if (!response.ok) {
            const data = await response.json();
            alert(`Unable to open billing portal. ${data.error || "Please try again."}`);
            setLoadingPlan(false);
            return;
          }

          const data = await response.json();

          if (data.error) {
            alert(`Unable to open billing portal: ${data.error}`);
            setLoadingPlan(false);
            return;
          }

          if (data.url) {
            // Redirect to Stripe portal where they can change their plan
            window.location.href = data.url;
          } else {
            alert("Unable to open billing portal. Please try again.");
            setLoadingPlan(false);
          }
        }
        // Handle upgrades
        else if (ctaText.includes("Upgrade")) {
          const targetTier = ctaText.includes("Enterprise") ? "enterprise" : "pro";

          const response = await apiClient.post("/api/stripe/create-checkout-session", {

          const data = await response.json();

          if (data.error) {
            alert(`Failed to upgrade: ${data.error}`);
            return;
          }

          if (data.url) {
            // Redirect to Stripe Checkout for upgrade
            window.location.href = data.url;
          } else {
            alert("Failed to create checkout session");
          }
        }
        // Handle Start Free Trial for non-logged in or new users
        else if (ctaText === "Start Free Trial") {
          router.push("/select-plan");
        }
      } catch {
        alert("Failed to process plan change. Please try again.");
      } finally {
        setLoadingPlan(false);
      }
    } else {
      router.push("/select-plan");
    }
  };

  const handleSignIn = () => {
    router.push("/sign-in");
  };

  const handleDemo = () => {
    router.push("/demo");
  };

  // Get CTA text and variant based on user's current plan
  const getPlanCTA = (planName: string): string => {
    // Show loading state while fetching plan
    if (isSignedIn && loadingPlan) {
      return "Loading...";
    }

    // If not signed in, show default CTAs
    if (!isSignedIn) {
      return planName === "Enterprise" ? "Contact Sales" : "Start Free Trial";
    }

    // User is signed in - check their plan
    if (!userPlan) {
      // Signed in but no plan yet (shouldn't happen, but handle gracefully)
      // Return default CTA for signed-in users without a plan
      return planName === "Enterprise" ? "Contact Sales" : "Start Free Trial";
    }

    const planLower = planName.toLowerCase();

    // User is on Enterprise
    if (userPlan === "enterprise") {
      if (planLower === "enterprise") return "Current Plan";
      if (planLower === "pro") return "Downgrade to Pro";
      if (planLower === "starter") return "Downgrade to Starter";
    }

    // User is on Pro
    if (userPlan === "pro") {
      if (planLower === "pro") return "Current Plan";
      if (planLower === "enterprise") return "Upgrade to Enterprise";
      if (planLower === "starter") return "Downgrade to Starter";
    }

    // User is on Starter
    if (userPlan === "starter") {
      if (planLower === "starter") return "Current Plan";
      if (planLower === "pro") return "Upgrade to Pro";
      if (planLower === "enterprise") return "Upgrade to Enterprise";
    }

    // Fallback (shouldn't reach here but ensures we always return a string)
    return planName === "Enterprise" ? "Contact Sales" : "Start Free Trial";
  };

  // Use shared PRICING_TIERS configuration
  const pricingPlans = Object.entries(PRICING_TIERS).map(([, tierData]) => ({

    notIncluded: [] as string[], // Can be customized per tier if needed

  }));

  const faqs = [
    {

      answer:
        "Once you create your account, you can generate unique QR codes for each table directly from the dashboard. Simply print them out and place them on your tables.",
    },
    {

      answer:
        "No! Servio works on any device with a web browser. You can manage orders from a tablet, smartphone, or computer. Your customers just need a smartphone to scan the QR code.",
    },
    {

    },
    {

      answer:
        "Yes! With the Pro plan, you can customize colors, fonts, and branding to match your venue's style.",
    },
    {

      answer:
        "We offer email support for all plans, and priority support for Pro plan users. We also have detailed documentation to guide you through setup.",
    },
    {

    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <HeroSection
        isSignedIn={isSignedIn}
        authLoading={false}
        onGetStarted={handleGetStarted}
        onSignIn={handleSignIn}
        onDemo={handleDemo}
      />

      <FeaturesSection />

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-800">
              Choose the plan that&apos;s right for your business
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => {
              const ctaText = getPlanCTA(plan.name);
              const isCurrentPlan = ctaText === "Current Plan";
              const isDowngradeCTA = ctaText.toLowerCase().includes("downgrade");
              const pricingButtonClass = cn(
                "w-full group transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 hover:text-servio-purple disabled:bg-gray-400 disabled:hover:bg-gray-400 disabled:cursor-not-allowed disabled:text-white border-2 border-servio-purple bg-servio-purple text-white",
                isDowngradeCTA && "bg-servio-purple text-white"
              );

              return (
                <Card
                  key={index}
                  className={`border-2 shadow-lg ${plan.popular ? "border-purple-500 relative" : ""}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-purple-600 text-white px-4 py-1">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-2xl mb-2 text-gray-900 font-bold">
                      {plan.name}
                    </CardTitle>
                    <div className="flex items-baseline justify-center">
                      <span className="text-5xl font-bold text-gray-900">{plan.price}</span>
                      {plan.period && (
                        <span className="text-gray-900 ml-2 font-medium">/{plan.period}</span>
                      )}
                    </div>
                    <CardDescription className="mt-4 text-gray-800 font-medium">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start">
                          <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-900 font-medium">{feature}</span>
                        </li>
                      ))}
                      {plan.notIncluded.map((feature, idx) => (
                        <li key={idx} className="flex items-start opacity-50">
                          <X className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-900 font-medium">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => handlePlanAction(ctaText)}
                      variant="servio"
                      className={pricingButtonClass}
                      size="lg"
                      disabled={isCurrentPlan || loadingPlan}
                    >
                      <span className="font-bold text-xs sm:text-sm md:text-base text-white break-words leading-tight px-1">
                        {ctaText || "Start Free Trial"}
                      </span>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <TestimonialsSection />

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-xl text-gray-800">Everything you need to know about Servio</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      <CTASection
        isSignedIn={isSignedIn}
        authLoading={false}
        onGetStarted={handleGetStarted}
        onSignIn={handleSignIn}
        onDemo={handleDemo}
      />

      <Footer />
    </div>
  );
}
