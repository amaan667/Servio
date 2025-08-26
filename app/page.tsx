"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/app/authenticated-client-provider";
import {
  QrCode,
  Smartphone,
  CreditCard,
  BarChart3,
  Clock,
  Users,
  Star,
  CheckCircle,
  ArrowRight,
  Menu,
  X,
} from "lucide-react";

function PricingQuickCompare() {
  return (
    <div className="w-full flex flex-col items-center gap-8 py-10">
      <h2 className="text-3xl font-bold mb-4">Choose the plan that works best for your business</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        {/* Basic */}
        <Card className="flex flex-col items-center p-6 gap-4">
          <div className="text-2xl font-semibold">Basic</div>
          <div className="text-3xl font-bold mb-1">£99<span className="text-lg font-normal">/month</span></div>
          <ul className="mb-4 space-y-1 text-left">
            <li>✔ Up to 10 tables</li>
            <li>✔ QR ordering</li>
            <li>✔ 14-day free trial</li>
          </ul>
          <Button className="w-full bg-purple-600 text-white">Start Free Trial</Button>
        </Card>
        {/* Standard */}
        <Card className="flex flex-col items-center p-6 gap-4 border-2 border-purple-500 shadow-lg scale-105">
          <div className="text-2xl font-semibold">Standard</div>
          <div className="w-full flex justify-center">
            <span className="bg-purple-500 text-white text-xs px-3 py-1 rounded-full mb-2">Most Popular</span>
          </div>
          <div className="text-3xl font-bold mb-1">£249<span className="text-lg font-normal">/month</span></div>
          <ul className="mb-4 space-y-1 text-left">
            <li>✔ Everything in Basic, plus:</li>
            <li>✔ Up to 20 tables</li>
            <li>✔ Full analytics dashboard</li>
            <li>✔ Email support</li>
          </ul>
          <Button className="w-full bg-purple-600 text-white">Start Free Trial</Button>
        </Card>
        {/* Premium */}
        <Card className="flex flex-col items-center p-6 gap-4">
          <div className="text-2xl font-semibold">Premium</div>
          <div className="text-3xl font-bold mb-1">£449+<span className="text-lg font-normal">/month</span></div>
          <ul className="mb-4 space-y-1 text-left">
            <li>✔ Everything in Standard, plus:</li>
            <li>✔ Unlimited tables & venues</li>
            <li>✔ Priority support</li>
            <li>✔ Custom onboarding & integrations</li>
          </ul>
          <Button className="w-full bg-gray-900 text-white">Contact Sales</Button>
        </Card>
      </div>
    </div>
  );
}

function HomePageContent() {
  const router = useRouter();
  
  // Use our central auth context instead of duplicating logic
  const { session, loading, error } = useAuth();

  // Show error if authentication fails
  if (error) {
    console.error('[HOME] Auth error:', error);
    // Continue with null session instead of breaking the page
  }

  const handleGetStarted = () => {
    console.log('[HOME] handleGetStarted called', { hasSession: !!session, sessionId: session?.user?.id });
    if (session) {
      console.log('[HOME] Redirecting to dashboard');
      router.push("/dashboard");
    } else {
      console.log('[HOME] Redirecting to sign-up');
      router.push("/sign-up");
    }
  };

  const handleSignIn = () => {
    console.log('[HOME] handleSignIn called', { hasSession: !!session, sessionId: session?.user?.id });
    if (session) {
      console.log('[HOME] Redirecting to dashboard');
      router.push("/dashboard");
    } else {
      console.log('[HOME] Redirecting to sign-in');
      router.push("/sign-in");
    }
  };

  const handleDemo = () => {
    if (session) {
      router.push("/order?venue=demo-cafe&table=1");
    } else {
      router.push("/order?demo=1");
    }
  };

  // Don't redirect automatically - let users view the features page even when logged in
  // The buttons above will handle navigation appropriately

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 text-white overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="bg-white/20 text-white border-white/30 mb-6">
                <QrCode className="w-4 h-4 mr-2" />
                Transform Your Business
              </Badge>
              <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                QR Code Ordering
                <br />
                <span className="text-purple-900">Made Simple</span>
              </h1>
              <p className="text-xl text-purple-100 mb-8 leading-relaxed">
                Streamline your business operations with contactless QR code
                ordering. Customers scan, order, and pay - all from their
                phones. You focus on great food and service.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button
                  size="lg"
                  onClick={handleGetStarted}
                  className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-4"
                >
                  {session ? 'Go to Dashboard' : 'Start Free Trial'}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white hover:text-purple-600 text-lg px-8 py-4 bg-transparent"
                  onClick={handleDemo}
                >
                  <QrCode className="mr-2 h-5 w-5" />
                  View Demo
                </Button>
              </div>
              <div className="flex items-center space-x-8 text-purple-100">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span>14-day free trial</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span>No setup fees</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                <div className="text-center">
                  <div className="w-32 h-32 bg-purple-100 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                    <QrCode className="w-16 h-16 text-purple-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Table 5
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Scan to view menu & order
                  </p>
                  <Badge className="bg-green-100 text-green-800">
                    Ready to Order
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Modernize Your Business
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From QR code generation to real-time order management, Servio
              provides all the tools you need to create a seamless dining
              experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <QrCode className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                QR Code Generation
              </h3>
              <p className="text-gray-600">
                Generate unique QR codes for each table. Customers scan and
                instantly access your digital menu.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <Smartphone className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Mobile-First Ordering
              </h3>
              <p className="text-gray-600">
                Customers order directly from their phones. No apps to download,
                no waiting for servers.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Integrated Payments
              </h3>
              <p className="text-gray-600">
                Secure payment processing with Stripe. Customers pay instantly,
                you get paid faster.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Real-Time Analytics
              </h3>
              <p className="text-gray-600">
                Track orders, revenue, and customer behavior in real-time.
                Make data-driven decisions.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Order Management
              </h3>
              <p className="text-gray-600">
                Real-time order notifications, status updates, and kitchen
                management tools.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Staff Management
              </h3>
              <p className="text-gray-600">
                Manage staff schedules, track performance, and streamline
                operations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Choose the plan that fits your business. All plans include our
              14-day free trial with no setup fees.
            </p>
          </div>

          <PricingQuickCompare />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-purple-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-purple-100 mb-8 max-w-3xl mx-auto">
            Join thousands of restaurants already using Servio to streamline
            their operations and increase revenue.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-4"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-purple-600 text-lg px-8 py-4 bg-transparent"
              onClick={handleDemo}
            >
              <QrCode className="mr-2 h-5 w-5" />
              View Demo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePageContent />
    </Suspense>
  );
}
