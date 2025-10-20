"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Users, QrCode, BarChart3 } from "lucide-react";

// This component will show home page content for both authenticated and non-authenticated users
const HomePage = React.memo(function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        // If no authenticated user, show public home page
        setUser(null);
        setPrimaryVenueId(null);
      } else {
        // User is authenticated, show authenticated home page
        setUser(user);
        
        // Fetch primary venue
        const { data: venues } = await supabase
          .from('venues')
          .select('venue_id')
          .eq('owner_user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);
        
        if (venues && venues.length > 0) {
          setPrimaryVenueId(venues[0].venue_id);
        }
      }
    } catch (error) {
      // On error, show public home page

      setUser(null);
      setPrimaryVenueId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    // Initial auth check
    checkAuth();

    // Listen for auth state changes
    const supabase = createClient();
    const result = supabase?.auth?.onAuthStateChange?.((event: any, session: any) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => {
      try {
        (result as any)?.data?.subscription?.unsubscribe?.();
      } catch {}
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Servio</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <span className="text-gray-900">Welcome, {user.email}</span>
                  <Link href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/'}>
                    <Button>Dashboard</Button>
                  </Link>
                  <Link href="/sign-out">
                    <Button variant="outline">Sign Out</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/sign-in">
                    <Button variant="outline">Sign In</Button>
                  </Link>
                  <Link href="/sign-up">
                    <Button>Sign Up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Servio
          </h2>
          <p className="text-xl text-gray-700 dark:text-gray-600 max-w-2xl mx-auto">
            The complete restaurant management solution with QR code ordering, 
            real-time analytics, and seamless customer experience.
          </p>
        </div>

        {user ? (
          // Authenticated user content
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <LayoutDashboard className="h-5 w-5 mr-2" />
                  Dashboard
                </CardTitle>
                <CardDescription>
                  Manage your restaurant operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/'}>
                  <Button className="w-full">Go to Dashboard</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <QrCode className="h-5 w-5 mr-2" />
                  QR Codes
                </CardTitle>
                <CardDescription>
                  Generate QR codes for your tables
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard">
                  <Button className="w-full" variant="outline">Go to Dashboard</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Analytics
                </CardTitle>
                <CardDescription>
                  View your restaurant analytics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={primaryVenueId ? `/dashboard/${primaryVenueId}/analytics` : '/'}>
                  <Button className="w-full" variant="outline">View Analytics</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Public content
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <QrCode className="h-5 w-5 mr-2" />
                  QR Code Ordering
                </CardTitle>
                <CardDescription>
                  Customers scan QR codes to view menus and place orders
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <LayoutDashboard className="h-5 w-5 mr-2" />
                  Real-time Management
                </CardTitle>
                <CardDescription>
                  Manage orders, tables, and staff in real-time
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Analytics & Insights
                </CardTitle>
                <CardDescription>
                  Get detailed insights into your restaurant performance
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        <div className="text-center mt-12">
          <p className="text-gray-700 dark:text-gray-600 mb-4">
            Ready to transform your restaurant experience?
          </p>
          {!user && (
            <div className="space-x-4">
              <Link href="/sign-up">
                <Button size="lg">Get Started</Button>
              </Link>
              <Link href="/sign-in">
                <Button size="lg" variant="outline">Sign In</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default HomePage;
