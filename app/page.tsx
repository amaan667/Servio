"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { supabase } from "@/lib/supabase";

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
  const [session, setSession] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [processingOAuth, setProcessingOAuth] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      if (!searchParams) return;
      
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        console.error('OAuth error:', error, errorDescription);
        return;
      }

      if (code && !processingOAuth) {
        console.log('Processing OAuth callback with code:', code);
        setProcessingOAuth(true);
        
        try {
          // Let Supabase handle the OAuth callback
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('Error exchanging code for session:', error);
            // Clear the URL parameters to prevent re-processing
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            console.log('OAuth callback successful:', data);
            // Clear the URL parameters and redirect to dashboard
            window.history.replaceState({}, document.title, '/dashboard');
            router.push('/dashboard');
          }
        } catch (err) {
          console.error('Error processing OAuth callback:', err);
          // Clear the URL parameters to prevent re-processing
          window.history.replaceState({}, document.title, window.location.pathname);
        } finally {
          setProcessingOAuth(false);
        }
      }
    };

    handleOAuthCallback();
  }, [searchParams, processingOAuth, router]);

  const handleGetStarted = () => {
    if (session) {
      router.push("/dashboard");
    } else {
      router.push("/sign-up");
    }
  };

  const handleSignIn = () => {
    if (session) {
      router.push("/dashboard");
    } else {
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

  // Show loading state while processing OAuth
  if (processingOAuth) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Completing sign in...</p>
        </div>
      </div>
    );
  }

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
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-6">
                  <QrCode className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  QR Code Generation
                </h3>
                <p className="text-gray-600">
                  Generate unique QR codes for each table. Customers scan to
                  instantly access your menu and start ordering.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-6">
                  <Smartphone className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Mobile-First Design
                </h3>
                <p className="text-gray-600">
                  Beautiful, responsive interface optimized for mobile devices.
                  Your customers will love the smooth ordering experience.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-6">
                  <Clock className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Real-Time Orders
                </h3>
                <p className="text-gray-600">
                  Receive orders instantly in your dashboard. Track order status
                  and manage your kitchen workflow efficiently.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-6">
                  <CreditCard className="h-6 w-6 text-yellow-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Payment Integration
                </h3>
                <p className="text-gray-600">
                  Secure payment processing built-in. Accept all major credit
                  cards and digital wallets seamlessly.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-6">
                  <BarChart3 className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Analytics & Insights
                </h3>
                <p className="text-gray-600">
                  Detailed analytics on sales, popular items, and customer
                  behavior to help you make data-driven decisions.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-6">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Staff Management
                </h3>
                <p className="text-gray-600">
                  Manage your team with role-based access. Kitchen staff,
                  servers, and managers each get the tools they need.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Loved by Businesses Everywhere
            </h2>
            <p className="text-xl text-gray-600">
              See what business owners are saying about Servio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 text-yellow-400 fill-current"
                    />
                  ))}
                </div>
                <p className="text-gray-600 mb-6">
                  "Servio transformed our cafe completely. Orders are faster,
                  more accurate, and our customers love the convenience. Revenue
                  is up 30%!"
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-purple-600 font-semibold">SM</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      Sarah Mitchell
                    </p>
                    <p className="text-gray-600">Owner, Corner Cafe</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 text-yellow-400 fill-current"
                    />
                  ))}
                </div>
                <p className="text-gray-600 mb-6">
                  "The setup was incredibly easy. Within an hour, we had QR
                  codes on all our tables. The real-time order management is a
                  game-changer."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-blue-600 font-semibold">MR</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      Mike Rodriguez
                    </p>
                    <p className="text-gray-600">Manager, Pizza Palace</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 text-yellow-400 fill-current"
                    />
                  ))}
                </div>
                <p className="text-gray-600 mb-6">
                  "Our staff can focus on food quality instead of taking orders.
                  Customer satisfaction has improved dramatically since we
                  started using Servio."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-green-600 font-semibold">LC</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Lisa Chen</p>
                    <p className="text-gray-600">Chef, Bistro 42</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* PricingQuickCompare Section */}
      <section id="pricing" className="py-24 bg-white">
        <PricingQuickCompare />
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Join businesses across the UK who use Servio to simplify ordering and improve customer experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={handleGetStarted}
              className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-4"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white hover:text-purple-600 text-lg px-8 py-4 bg-transparent"
              onClick={handleDemo}
            >
              Try the Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <p className="text-gray-400 mb-6 max-w-md">
                Servio makes QR code ordering simple and effective for
                businesses of all sizes. Transform your customer experience
                today.
              </p>
              <div className="flex space-x-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-white"
                >
                  <span className="sr-only">Facebook</span>
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M20 10C20 4.477 15.523 0 10 0S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-white"
                >
                  <span className="sr-only">Twitter</span>
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-white"
                >
                  <span className="sr-only">LinkedIn</span>
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="#features"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="#pricing"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/order?venue=demo-cafe&table=1"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Demo
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    API
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Status
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Servio. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
