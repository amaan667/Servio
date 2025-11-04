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

// FAQ Item Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl bg-purple-600 shadow-lg hover:shadow-xl transition-all duration-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 text-left flex justify-between items-center gap-4 focus:outline-none group"
        style={{ color: "white" }}
      >
        <h3 className="font-semibold text-base md:text-lg !text-white" style={{ color: "white" }}>
          {question}
        </h3>
        <div className="ml-4 flex-shrink-0">
          {isOpen ? (
            <ChevronUp
              className="h-5 w-5 !text-white transition-transform duration-200 ease-out"
              style={{ color: "white" }}
            />
          ) : (
            <ChevronDown
              className="h-5 w-5 !text-white transition-transform duration-200 ease-out"
              style={{ color: "white" }}
            />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="px-5 pt-3 pb-4 border-t border-purple-500/30">
          <p className="!text-white leading-relaxed" style={{ color: "white" }}>
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

interface HomePageClientProps {
  initialAuthState: boolean;
  initialUserPlan?: "basic" | "standard" | "premium" | null;
}

export function HomePageClient({ initialAuthState, initialUserPlan = null }: HomePageClientProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Use server-provided auth state and plan - prevents flicker
  const [isSignedIn, setIsSignedIn] = useState(initialAuthState);
  const [userPlan, setUserPlan] = useState<"basic" | "standard" | "premium" | null>(
    initialUserPlan
  );
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Set mounted state on client-side only
  useEffect(() => {
    setMounted(true);
  }, []);

  // Debug logging
  useEffect(() => {
    console.log("[HOMEPAGE] Auth state:", {
      isSignedIn,
      userPlan,
      initialUserPlan,
      user: user ? "present" : "null",
      mounted,
    });
  }, [isSignedIn, userPlan, initialUserPlan, user, mounted]);

  // Sync with auth context when it updates (but only if different)
  useEffect(() => {
    const currentAuthState = !!user;
    if (currentAuthState !== isSignedIn) {
      console.log("[HOMEPAGE] Auth state changed:", { from: isSignedIn, to: currentAuthState });
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
        console.log("[HOMEPAGE] Fetching user plan from client...");
        try {
          const supabase = supabaseBrowser();
          const { data: venues } = await supabase
            .from("venues")
            .select("organization_id")
            .eq("owner_user_id", user.id)
            .limit(1);

          if (venues && venues.length > 0 && venues[0].organization_id) {
            const { data: org } = await supabase
              .from("organizations")
              .select("subscription_tier")
              .eq("id", venues[0].organization_id)
              .maybeSingle();

            if (org?.subscription_tier) {
              const plan = org.subscription_tier.toLowerCase() as "basic" | "standard" | "premium";
              console.log("[HOMEPAGE] Fetched plan from client:", plan);
              setUserPlan(plan);
            }
          }
        } catch (error) {
          console.error("[HOMEPAGE] Error fetching user plan:", error);
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
      // Get user's first venue
      const supabase = supabaseBrowser();
      const { data: venues } = await supabase
        .from("venues")
        .select("venue_id")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true }) // ✅ Get FIRST venue (oldest)
        .limit(1);

      if (venues && venues.length > 0 && venues[0]) {
        router.push(`/dashboard/${venues[0].venue_id}`);
      } else {
        router.push("/select-plan");
      }
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
      window.location.href = "mailto:support@servio.app?subject=Premium Plan Inquiry";
      return;
    }

    // For upgrades/downgrades
    if (isSignedIn && user) {
      setLoadingPlan(true);
      try {
        const supabase = supabaseBrowser();
        const { data: venues } = await supabase
          .from("venues")
          .select("venue_id, organization_id")
          .eq("owner_user_id", user.id)
          .limit(1)
          .single();

        if (!venues?.organization_id) {
          alert("No organization found");
          setLoadingPlan(false);
          return;
        }

        // Verify we have a valid session first
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          alert("Session expired. Please sign in again.");
          router.push("/sign-in");
          setLoadingPlan(false);
          return;
        }

        const { apiClient } = await import("@/lib/api-client");

        // Handle downgrades - redirect to Stripe portal
        if (ctaText.includes("Downgrade")) {
          // Open Stripe portal where users can manage/downgrade their plan
          const response = await apiClient.post("/api/stripe/create-portal-session", {
            organizationId: venues.organization_id,
            venueId: venues.venue_id,
          });

          if (!response.ok) {
            const data = await response.json();
            console.error("[PRICING] Failed to open billing portal:", data);
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
          const targetTier = ctaText.includes("Premium") ? "premium" : "standard";

          const response = await apiClient.post("/api/stripe/create-checkout-session", {
            tier: targetTier,
            organizationId: venues.organization_id,
          });

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
      } catch (error) {
        console.error("[PRICING] Error processing plan change:", error);
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
      return planName === "Premium" ? "Contact Sales" : "Start Free Trial";
    }

    // User is signed in - check their plan
    if (!userPlan) {
      // Signed in but no plan yet (shouldn't happen, but handle gracefully)
      // Return default CTA for signed-in users without a plan
      return planName === "Premium" ? "Contact Sales" : "Start Free Trial";
    }

    const planLower = planName.toLowerCase();

    // User is on Premium
    if (userPlan === "premium") {
      if (planLower === "premium") return "Current Plan";
      if (planLower === "standard") return "Downgrade to Standard";
      if (planLower === "basic") return "Downgrade to Basic";
    }

    // User is on Standard
    if (userPlan === "standard") {
      if (planLower === "standard") return "Current Plan";
      if (planLower === "premium") return "Upgrade to Premium";
      if (planLower === "basic") return "Downgrade to Basic";
    }

    // User is on Basic
    if (userPlan === "basic") {
      if (planLower === "basic") return "Current Plan";
      if (planLower === "standard") return "Upgrade to Standard";
      if (planLower === "premium") return "Upgrade to Premium";
    }

    // Fallback (shouldn't reach here but ensures we always return a string)
    console.warn("[HOMEPAGE] getPlanCTA fallback reached", { planName, userPlan, isSignedIn });
    return planName === "Premium" ? "Contact Sales" : "Start Free Trial";
  };

  const pricingPlans = [
    {
      name: "Basic",
      price: "£99",
      period: "per month",
      description: "Perfect for small cafes and food trucks",
      features: [
        "Up to 50 menu items",
        "QR code ordering",
        "Order management",
        "Payment processing",
        "Basic analytics",
        "Email support",
      ],
      notIncluded: ["Custom branding", "Advanced analytics", "Priority support"],
      popular: false,
    },
    {
      name: "Standard",
      price: "£249",
      period: "per month",
      description: "For growing restaurants and cafes",
      features: [
        "Unlimited menu items",
        "QR code ordering",
        "Order management",
        "Payment processing",
        "Advanced analytics",
        "Inventory management",
        "Staff management",
        "Priority support",
      ],
      notIncluded: ["Custom branding", "White-label options"],
      popular: true,
    },
    {
      name: "Premium",
      price: "£449+",
      period: "per month",
      description: "For established restaurants and chains",
      features: [
        "Everything in Standard",
        "Custom branding",
        "White-label options",
        "Multi-location support",
        "Advanced reporting",
        "Dedicated account manager",
        "Custom integrations",
        "24/7 phone support",
      ],
      notIncluded: [],
      popular: false,
    },
  ];

  const faqs = [
    {
      question: "How do I set up QR codes for my tables?",
      answer:
        "Once you create your account, you can generate unique QR codes for each table directly from the dashboard. Simply print them out and place them on your tables.",
    },
    {
      question: "Do I need special hardware or equipment?",
      answer:
        "No! Servio works on any device with a web browser. You can manage orders from a tablet, smartphone, or computer. Your customers just need a smartphone to scan the QR code.",
    },
    {
      question: "How do customers pay for their orders?",
      answer:
        "Customers can pay directly through the ordering interface using credit cards or digital wallets. Payment is processed securely through Stripe.",
    },
    {
      question: "Can I customize the menu appearance?",
      answer:
        "Yes! With the Professional plan, you can customize colors, fonts, and branding to match your venue's style.",
    },
    {
      question: "What if I need help setting up?",
      answer:
        "We offer email support for all plans, and priority support for Professional plan users. We also have detailed documentation to guide you through setup.",
    },
    {
      question: "Can I try Servio before committing?",
      answer:
        "Absolutely! We offer a 14-day free trial for all paid plans. No credit card required to start.",
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
                      variant={null}
                      className="w-full bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:bg-gray-400 disabled:hover:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 border-0"
                      size="lg"
                      disabled={isCurrentPlan || loadingPlan}
                    >
                      <span className="text-white font-bold text-base" style={{ color: "white" }}>
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
