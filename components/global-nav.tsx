"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Menu, X, Settings, Home, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import SignInButton from "@/app/components/SignInButton";

import { signOutUser } from "@/lib/supabase";

export default function GlobalNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(null);
  // Use our central auth context instead of local state
  const { session, loading, signOut } = useAuth();
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
  const isOnHomePage = pathname === '/';
  const isOnSettings = pathname?.includes('/settings');
  const isOnQRPage = pathname?.includes('/generate-qr') || pathname?.includes('/qr');
  
  // Extract venueId from pathname for venue-specific navigation
  const venueId = pathname?.match(/\/dashboard\/([^/]+)/)?.[1];

  // Fetch primary venue when user is signed in
  useEffect(() => {
    const fetchPrimaryVenue = async () => {
      if (isAuthenticated && session?.user?.id) {
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
      console.log('[AUTH DEBUG] Starting sign out process');
      
      // Call unified API signout to clear cookies server-side
      const response = await fetch('/api/auth/signout', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' } 
      });
      
      if (!response.ok) {
        console.log('[AUTH DEBUG] Server-side sign out failed');
      } else {
        console.log('[AUTH DEBUG] Server-side sign out successful');
      }
      
      // Use the auth provider's signOut method
      await signOut();
      
      // Force redirect to home page
      router.replace('/');
      
      console.log('[AUTH DEBUG] Sign out completed, redirected to home');
    } catch (error) {
      console.error('[AUTH DEBUG] Sign out error:', error);
      // Force redirect even if there's an error
      router.replace('/');
    }
  };

  // Don't render navigation items while loading
  if (loading) {
    return (
      <nav className="bg-white border-b border-gray-200/60 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-0 sm:px-1 lg:px-2">
          <div className="flex justify-between items-center h-28 sm:h-32 md:h-36 lg:h-40 xl:h-44">
            {/* Logo */}
            <div className="flex-shrink-0 -ml-4">
              <Link href="/" className="flex items-center group">
                <Image
                  src="/assets/servio-logo-updated.png"
                  alt="Servio"
                  width={800}
                  height={250}
                  className="h-36 sm:h-42 md:h-48 lg:h-54 xl:h-60 w-auto transition-all duration-300 group-hover:scale-105"
                  priority
                />
              </Link>
            </div>
            
            {/* Loading indicator */}
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white border-b border-gray-200/60 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-0 sm:px-1 lg:px-2">
        <div className="flex justify-between items-center h-28 sm:h-32 md:h-36 lg:h-40 xl:h-44">
          {/* Logo */}
          <div className="flex-shrink-0 -ml-4">
            <Link href={isAuthenticated ? (venueId ? `/dashboard/${venueId}` : "/dashboard") : "/"} className="flex items-center group">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={800}
                height={250}
                className="h-36 sm:h-42 md:h-48 lg:h-54 xl:h-60 w-auto transition-all duration-300 group-hover:scale-105"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {isAuthenticated ? (
              // Signed in navigation - modern SaaS style
              <div className="flex items-center space-x-1">
                {isOnDashboard ? (
                  // On dashboard pages: Home, Settings, Sign Out
                  <>
                    <Link
                      href="/"
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200"
                    >
                      <Home className="mr-2 h-4 w-4" />
                      Home
                    </Link>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}/settings` : '/dashboard'}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </>
                ) : isOnSettings ? (
                  // On settings pages: Dashboard, Home, Sign Out
                  <>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/dashboard'}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200"
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200"
                    >
                      <Home className="mr-2 h-4 w-4" />
                      Home
                    </Link>
                  </>
                ) : (
                  // On home page and QR pages: Dashboard, Settings, Sign Out
                  <>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/dashboard'}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200"
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}/settings` : '/dashboard'}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </>
                )}
                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-all duration-200"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            ) : (
              // Not signed in navigation - modern SaaS style
              <div className="flex items-center space-x-1">
                <Link
                  href="/"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200"
                >
                  Home
                </Link>
                <Link
                  href="#features"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200"
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all duration-200"
                >
                  Pricing
                </Link>
                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                <Button
                  onClick={() => router.push('/sign-in')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 shadow-sm"
                >
                  Sign In
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {isAuthenticated ? (
              // Signed in mobile navigation
              <>
                {isOnDashboard ? (
                  <>
                    <Link
                      href="/"
                      className="flex items-center px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-3 h-5 w-5" />
                      Home
                    </Link>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}/settings` : '/dashboard'}
                      className="flex items-center px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="mr-3 h-5 w-5" />
                      Settings
                    </Link>
                  </>
                ) : isOnSettings ? (
                  <>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/dashboard'}
                      className="flex items-center px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5" />
                      Dashboard
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-3 h-5 w-5" />
                      Home
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/dashboard'}
                      className="flex items-center px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5" />
                      Dashboard
                    </Link>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}/settings` : '/dashboard'}
                      className="flex items-center px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="mr-3 h-5 w-5" />
                      Settings
                    </Link>
                  </>
                )}
                <div className="border-t border-gray-200 my-2"></div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full justify-start px-3 py-2 text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  Sign Out
                </Button>
              </>
            ) : (
              // Not signed in mobile navigation
              <>
                <Link
                  href="/"
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="#features"
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <div className="border-t border-gray-200 my-2"></div>
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
