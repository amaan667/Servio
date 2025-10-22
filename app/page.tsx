"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { HeroSection } from './components/HeroSection';
import { FeaturesSection } from './components/FeaturesSection';
import { TestimonialsSection } from './components/TestimonialsSection';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';

export default function HomePage() {
  const router = useRouter();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!supabase) return;
        const { data: { session: checkAuthSession } } = await supabase.auth.getSession();
        setIsSignedIn(!!checkAuthSession?.user);
      } catch {
        // Silent error handling
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();

    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: string, session: { user?: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } } | null) => {
        setIsSignedIn(!!session?.user);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGetStarted = async () => {
    if (isSignedIn) {
      // Get user's first venue
      if (!supabase) {
        router.push("/complete-profile");
        return;
      }
      const { data: { session: checkSession } } = await supabase.auth.getSession();
      const checkUser = checkSession?.user;
      if (!checkUser) {
        router.push("/sign-up");
        return;
      }
      const { data: venues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', checkUser.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (venues && venues.length > 0 && venues[0]) {
        router.push(`/dashboard/${venues[0].venue_id}`);
      } else {
        router.push("/complete-profile");
      }
    } else {
      router.push("/sign-up");
    }
  };

  const handleSignIn = () => {
    router.push("/sign-in");
  };

  const handleDemo = () => {
    router.push("/demo");
  };

  const pricingPlans = [
    {
      name: "Free",
      price: "£0",
      period: "forever",
      description: "Perfect for testing Servio",
      features: [
        "Up to 10 menu items",
        "Basic QR ordering",
        "Order management",
        "Email support",
      ],
      notIncluded: [
        "Advanced analytics",
        "Custom branding",
        "Priority support",
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Starter",
      price: "£29",
      period: "per month",
      description: "For small cafes and food trucks",
      features: [
        "Unlimited menu items",
        "QR ordering",
        "Order management",
        "Payment processing",
        "Basic analytics",
        "Email support",
      ],
      notIncluded: [
        "Custom branding",
        "Priority support",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      name: "Professional",
      price: "£79",
      period: "per month",
      description: "For established restaurants",
      features: [
        "Everything in Starter",
        "Custom branding",
        "Advanced analytics",
        "Inventory management",
        "Staff management",
        "Priority support",
      ],
      notIncluded: [],
      cta: "Start Free Trial",
      popular: false,
    },
  ];

  const faqs = [
    {
      question: "How do I set up QR codes for my tables?",
      answer: "Once you create your account, you can generate unique QR codes for each table directly from the dashboard. Simply print them out and place them on your tables.",
    },
    {
      question: "Do I need special hardware or equipment?",
      answer: "No! Servio works on unknown device with a web browser. You can manage orders from a tablet, smartphone, or computer. Your customers just need a smartphone to scan the QR code.",
    },
    {
      question: "How do customers pay for their orders?",
      answer: "Customers can pay directly through the ordering interface using credit cards or digital wallets. Payment is processed securely through Stripe.",
    },
    {
      question: "Can I customize the menu appearance?",
      answer: "Yes! With the Professional plan, you can customize colors, fonts, and branding to match your venue's style.",
    },
    {
      question: "What if I need help setting up?",
      answer: "We offer email support for all plans, and priority support for Professional plan users. We also have detailed documentation to guide you through setup.",
    },
    {
      question: "Can I try Servio before committing?",
      answer: "Absolutely! We offer a 14-day free trial for all paid plans. No credit card required to start.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <HeroSection
        isSignedIn={isSignedIn}
        authLoading={authLoading}
        onGetStarted={handleGetStarted}
        onSignIn={handleSignIn}
        onDemo={handleDemo}
      />

      <FeaturesSection />

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-800">
              Choose the plan that&apos;s right for your business
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pricingPlans.map((plan, index) => (
              <Card
                key={index}
                className={`border-2 shadow-lg ${plan.popular ? 'border-purple-500 relative' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-purple-600 text-white px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center">
                    <span className="text-5xl font-bold text-gray-900">{plan.price}</span>
                    {plan.period && (
                      <span className="text-gray-800 ml-2">/{plan.period}</span>
                    )}
                  </div>
                  <CardDescription className="mt-4">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-800">{feature}</span>
                      </li>
                    ))}
                    {plan.notIncluded.map((feature, idx) => (
                      <li key={idx} className="flex items-start opacity-50">
                        <X className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-800">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={handleGetStarted}
                    className={`w-full ${plan.popular ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
                    size="lg"
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <TestimonialsSection />

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-800">
              Everything you need to know about Servio
            </p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <Card key={index} className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-800">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <CTASection
        isSignedIn={isSignedIn}
        authLoading={authLoading}
        onGetStarted={handleGetStarted}
        onSignIn={handleSignIn}
        onDemo={handleDemo}
      />

      <Footer />
    </div>
  );
}
