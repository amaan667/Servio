"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Menu, X, Settings } from "lucide-react";
import { useAuth } from "@/app/authenticated-client-provider";
import { useRouter, usePathname } from "next/navigation";
import SignInButton from "@/app/components/SignInButton";
import { signOutUser } from "@/lib/supabase";

export default function GlobalNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(null);
  // Use our central auth context instead of local state
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // Ensure we don't show authenticated navigation while loading
  // Also add additional checks to ensure session is valid
  const isAuthenticated = !loading && !!session?.user && !!session?.access_token;

  // Debug logging for authentication state
  useEffect(() => {
    console.log('[NAV DEBUG] Authentication state changed:', {
      loading,
      hasSession: !!session,
      hasUser: !!session?.user,
      hasAccessToken: !!session?.access_token,
      userId: session?.user?.id,
      isAuthenticated,
      pathname,
      timestamp: new Date().toISOString()
    });
  }, [loading, session, isAuthenticated, pathname]);

  // Determine if we're on dashboard pages
  const isOnDashboard = pathname?.startsWith('/dashboard');
  
  // Extract venueId from pathname for venue-specific navigation
  const venueId = pathname?.match(/\/dashboard\/([^/]+)/)?.[1];

  // Fetch primary venue when user is signed in
  useEffect(() => {
    const fetchPrimaryVenue = async () => {
      if (isAuthenticated) {
        try {
          const { data, error } = await supabase
            .from('venues')
            .select('venue_id')
            .eq('owner_id', session.user.id)
            .order('created_at', { ascending: true })
            .limit(1);

          if (!error && data?.length) {
            setPrimaryVenueId(data[0].venue_id);
          }
        } catch (err) {
          console.error('Error fetching primary venue:', err);
        }
      } else {
        setPrimaryVenueId(null);
      }
    };

    fetchPrimaryVenue();
  }, [isAuthenticated, session?.user?.id]);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
      router.replace('/');
    }
  };

  // Don't render navigation items while loading
  if (loading) {
    return (
      <nav className="bg-white/90 backdrop-blur-sm shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-28 sm:h-32 lg:h-36 xl:h-40">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center group">
                <Image
                  src="/assets/servio-logo-updated.png"
                  alt="Servio"
                  width={800}
                  height={250}
                  className="h-20 sm:h-24 lg:h-28 xl:h-32 2xl:h-36 w-auto transition-all duration-300 group-hover:scale-105 drop-shadow-xl filter brightness-110 contrast-110"
                  priority
                />
              </Link>
            </div>
            
            {/* Loading indicator */}
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white/90 backdrop-blur-sm shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-28 sm:h-32 lg:h-36 xl:h-40">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href={isAuthenticated ? (venueId ? `/dashboard/${venueId}` : "/dashboard") : "/"} className="flex items-center group">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={800}
                height={250}
                className="h-20 sm:h-24 lg:h-28 xl:h-32 2xl:h-36 w-auto transition-all duration-300 group-hover:scale-105 drop-shadow-xl filter brightness-110 contrast-110"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-6 lg:ml-10 flex items-center space-x-4 lg:space-x-6">
              {isAuthenticated ? (
                // Signed in navigation - different based on current page
                <>
                  {isOnDashboard ? (
                    // On dashboard pages: Home, Settings, Sign Out
                    <>
                      <Link
                        href={venueId ? `/dashboard/${venueId}` : "/dashboard"}
                        className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        Home
                      </Link>
                      <Link
                        href={venueId ? `/dashboard/${venueId}/settings` : "/dashboard"}
                        className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </>
                  ) : (
                    // On home page: Dashboard, Settings, Sign Out
                    <>
                      <Link
                        href="/dashboard"
                        className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/dashboard"
                        className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        Settings
                      </Link>
                    </>
                  )}
                  <Button
                    variant="destructive"
                    onClick={handleSignOut}
                    className="transition-colors"
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                // Not signed in navigation - only show public links
                <>
                  <Link
                    href="/"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Home
                  </Link>
                  <Link
                    href="#features"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Features
                  </Link>
                  <Link
                    href="#pricing"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Pricing
                  </Link>
                  <SignInButton />
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white/95 backdrop-blur border-t">
            {isAuthenticated ? (
              // Signed in mobile navigation - different based on current page
              <>
                {isOnDashboard ? (
                  // On dashboard pages: Home, Settings, Sign Out
                  <>
                    <Link
                      href={venueId ? `/dashboard/${venueId}` : "/dashboard"}
                      className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Home
                    </Link>
                    <Link
                      href={venueId ? `/dashboard/${venueId}/settings` : "/dashboard"}
                      className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </>
                ) : (
                  // On home page: Dashboard, Settings, Sign Out
                  <>
                    <Link
                      href="/dashboard"
                      className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard"
                      className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Settings
                    </Link>
                  </>
                )}
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left transition-colors"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              // Not signed in mobile navigation - only show public links
              <>
                <Link
                  href="/"
                  className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="#features"
                  className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <div onClick={() => setMobileMenuOpen(false)}>
                  <SignInButton />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
} 
