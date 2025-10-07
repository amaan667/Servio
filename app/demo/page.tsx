'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Briefcase, ArrowRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { demoMenuItems } from '@/data/demoMenuItems';

// Dynamically import heavy components to avoid hydration issues
const DemoAnalytics = dynamic(() => import('@/components/demo-analytics'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-96 bg-gray-100 rounded-lg"></div>
});

const DemoAISection = dynamic(() => import('@/components/demo-ai-section'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-96 bg-gray-100 rounded-lg"></div>
});

// Error boundary component for demo sections
function DemoErrorBoundary({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Demo component error:', error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export default function DemoPage() {
  const [viewMode, setViewMode] = useState<'customer' | 'owner'>('customer');
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Check auth status safely after component mounts
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user has auth cookies without using the hook during render
        const hasAuthCookies = document.cookie.includes('sb-') || 
                              document.cookie.includes('supabase');
        setIsAuthenticated(hasAuthCookies);
      } catch (error) {
        console.error('Auth check error:', error);
        // If auth check fails, default to unauthenticated
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Global error handler
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Demo page error:', error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-pulse h-32 w-32 rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-center">Demo Temporarily Unavailable</CardTitle>
            <CardDescription className="text-center">
              We're experiencing some technical difficulties with the demo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Please try refreshing the page or come back later.
            </p>
            <div className="flex gap-2">
              <Button 
                onClick={() => window.location.reload()} 
                className="flex-1"
              >
                Refresh Page
              </Button>
              <Button 
                onClick={() => window.location.href = '/'} 
                variant="outline" 
                className="flex-1"
              >
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50">
      {/* View Toggle */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                Try
                <img 
                  src="/assets/servio-logo-updated.png"
                  alt="Servio"
                  className="h-8 w-auto"
                />
              </h1>
              <p className="text-sm text-gray-600">Experience both perspectives</p>
            </div>
            <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
              <Button
                onClick={() => setViewMode('customer')}
                variant={viewMode === 'customer' ? 'default' : 'ghost'}
                className={`${
                  viewMode === 'customer'
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <User className="w-4 h-4 mr-2" />
                Customer 👤
              </Button>
              <Button
                onClick={() => setViewMode('owner')}
                variant={viewMode === 'owner' ? 'default' : 'ghost'}
                className={`${
                  viewMode === 'owner'
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Briefcase className="w-4 h-4 mr-2" />
                Owner 🧑‍💼
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {viewMode === 'customer' ? (
          <CustomerDemoView />
        ) : (
          <OwnerDemoView isAuthenticated={isAuthenticated} />
        )}
      </div>
    </div>
  );
}

function CustomerDemoView() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome to Servio Café</CardTitle>
          <CardDescription className="text-lg">
            Experience seamless mobile ordering with QR code scanning
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-700">
            In the real experience, you'd scan a QR code at your table. For this demo, 
            we'll take you straight to the menu.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/order?venue=demo-cafe&table=1" className="flex-1">
              <Button className="w-full bg-purple-600 hover:bg-purple-700 !text-white h-14 text-lg">
                Start Your Order
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h4 className="font-semibold text-blue-900 mb-2">What you'll experience:</h4>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start">
                <span className="mr-2">✅</span>
                <span>Browse a full menu with categories and images</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✅</span>
                <span>Add items to cart with special instructions</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✅</span>
                <span>Complete checkout with simulated Stripe payment</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✅</span>
                <span>Receive order confirmation and track status</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Sample Menu Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Menu Items</CardTitle>
          <CardDescription>Just a taste of what you'll see</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {demoMenuItems.slice(0, 6).map((item) => (
              <div key={item.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                <img 
                  src={item.image} 
                  alt={item.name}
                  className="w-full h-32 object-cover"
                />
                <div className="p-3">
                  <h4 className="font-semibold text-gray-900">{item.name}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                  <p className="text-lg font-bold text-purple-600 mt-2">£{item.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerDemoView({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="space-y-8">
      {/* Owner Hero */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
        <CardHeader>
          <CardTitle className="text-3xl">Owner Dashboard Preview</CardTitle>
          <CardDescription className="text-lg">
            See what you'd have access to as a Servio venue owner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-700">
            This demo showcases the powerful tools available to restaurant and café owners 
            using Servio's platform.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white border-2 border-purple-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-2">📊</div>
              <h4 className="font-bold text-gray-900">Live Analytics</h4>
              <p className="text-sm text-gray-600">Real-time insights into orders, revenue, and trends</p>
            </div>
            <div className="bg-white border-2 border-purple-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-2">🤖</div>
              <h4 className="font-bold text-gray-900">AI-Powered Insights</h4>
              <p className="text-sm text-gray-600">Smart suggestions for menu optimization</p>
            </div>
            <div className="bg-white border-2 border-purple-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-2">📱</div>
              <h4 className="font-bold text-gray-900">Live Order Management</h4>
              <p className="text-sm text-gray-600">Track and manage orders in real-time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo Analytics */}
      <DemoErrorBoundary fallback={
        <Card>
          <CardHeader>
            <CardTitle>Analytics Preview</CardTitle>
            <CardDescription>Analytics features coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Real-time analytics and insights will be available here.</p>
          </CardContent>
        </Card>
      }>
        <DemoAnalytics />
      </DemoErrorBoundary>

      {/* AI Demo Section */}
      <DemoErrorBoundary fallback={
        <Card>
          <CardHeader>
            <CardTitle>AI Features Preview</CardTitle>
            <CardDescription>AI-powered insights coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">AI-powered menu optimization and insights will be available here.</p>
          </CardContent>
        </Card>
      }>
        <DemoAISection />
      </DemoErrorBoundary>

      {/* Feature Highlights */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Features</CardTitle>
          <CardDescription>Everything you need to run your business</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl">📋</div>
              <div>
                <h4 className="font-semibold text-gray-900">Menu Management</h4>
                <p className="text-sm text-gray-600">
                  Easy-to-use interface for updating items, prices, and availability
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl">💳</div>
              <div>
                <h4 className="font-semibold text-gray-900">Payment Processing</h4>
                <p className="text-sm text-gray-600">
                  Secure Stripe integration for online and in-person payments
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl">👥</div>
              <div>
                <h4 className="font-semibold text-gray-900">Staff Management</h4>
                <p className="text-sm text-gray-600">
                  Add team members and manage permissions
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl">🎯</div>
              <div>
                <h4 className="font-semibold text-gray-900">Table Management</h4>
                <p className="text-sm text-gray-600">
                  QR codes for each table with real-time occupancy tracking
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card className="bg-gradient-to-r from-purple-600 to-purple-800 text-white border-0">
        <CardContent className="py-8 text-center">
          <h3 className="text-2xl font-bold mb-2 !text-white">
            {isAuthenticated ? "Ready to manage your venue?" : "Ready to get started?"}
          </h3>
          <p className="text-purple-100 mb-6">
            {isAuthenticated 
              ? "Access your dashboard to manage orders, analytics, and more"
              : "Create your account and have your venue live in minutes"
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button className="bg-white text-purple-600 hover:bg-gray-100">
                    Go to Dashboard
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="border-white !text-white hover:bg-purple-700">
                    Home
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/sign-up">
                  <Button className="bg-white text-purple-600 hover:bg-gray-100">
                    Start Free Trial
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button variant="outline" className="border-white !text-white hover:bg-purple-700">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}