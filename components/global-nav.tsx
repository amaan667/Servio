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

  // Debug logging
  console.log('[GLOBAL NAV] Component rendering:', { 
    loading, 
    hasSession: !!session, 
    pathname,
    timestamp: new Date().toISOString()
  });

  // Ensure we don't show authenticated navigation while loading
  // Also add additional checks to ensure session is valid
  const isAuthenticated = !loading && !!session?.user && !!session?.access_token;

  // Determine if we're on an authenticated route that supports dark mode
  const isAuthenticatedRoute = pathname?.startsWith('/dashboard') || 
                               pathname?.startsWith('/generate-qr') || 
                               pathname?.startsWith('/settings') ||
                               pathname?.startsWith('/complete-profile') ||
                               pathname?.startsWith('/sign-in') ||
                               pathname?.startsWith('/sign-up');

  // Use theme-aware colors for authenticated routes, light mode colors for public pages
  const navClasses = isAuthenticatedRoute 
    ? "bg-background border-b border-border shadow-sm sticky top-0 z-50"
    : "bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50";

  const textClasses = isAuthenticatedRoute
    ? "text-foreground hover:text-primary hover:bg-accent"
    : "text-gray-700 hover:text-gray-900 hover:bg-gray-50";

  const borderClasses = isAuthenticatedRoute
    ? "border-border"
    : "border-gray-200";

  const primaryButtonClasses = isAuthenticatedRoute
    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
    : "bg-purple-600 hover:bg-purple-700 text-white";

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
  const isOnQRPage = pathname?.includes('/generate-qr');
  
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
      // Call unified API signout to clear cookies server-side
      const response = await fetch('/api/auth/signout', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' } 
      });
      
      if (!response.ok) {
        console.error('Server-side sign out failed');
      }
      
      // Use the auth provider's signOut method
      await signOut();
      
      // Force redirect to home page
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
      // Force redirect even if there's an error
      router.replace('/');
    }
  };

  // Don't render navigation items while loading
  if (loading) {
    return (
      <nav className="bg-background border-b border-border shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-0 sm:px-1 lg:px-2">
          <div className="flex justify-between items-center h-28 sm:h-32 md:h-36 lg:h-40 xl:h-44">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center group">
                <Image
                  src="/assets/servio-logo-updated.png"
                  alt="Servio"
                  width={800}
                  height={250}
                  className="h-40 sm:h-44 md:h-48 lg:h-52 xl:h-56 w-auto transition-all duration-300 group-hover:scale-105"
                  priority
                />
              </Link>
            </div>
            
            {/* Loading indicator */}
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className={navClasses}>
      <div className="max-w-7xl mx-auto px-0 sm:px-1 lg:px-2">
        <div className="flex justify-between items-center h-28 sm:h-32 md:h-36 lg:h-40 xl:h-44">
          {/* Logo - Bigger and positioned in top left */}
          <div className="flex-shrink-0">
            <Link href={isAuthenticated ? (venueId ? `/dashboard/${venueId}` : "/dashboard") : "/"} className="flex items-center group">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={800}
                height={250}
                className="h-40 sm:h-44 md:h-48 lg:h-52 xl:h-56 w-auto transition-all duration-300 group-hover:scale-105"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation - Properly aligned to right corner */}
          <div className="hidden md:flex items-center space-x-2">
            {isAuthenticated ? (
              // Signed in navigation - modern SaaS style
              <div className="flex items-center space-x-2">
                {(isOnDashboard || isOnQRPage) ? (
                  // On dashboard pages and QR pages: Home, Settings, Sign Out
                  <>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-200"
                    >
                      <Home className="mr-3 h-5 w-5" />
                      Home
                    </Link>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}/settings` : '/dashboard'}
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-200"
                    >
                      <Settings className="mr-3 h-5 w-5" />
                      Settings
                    </Link>
                  </>
                ) : isOnSettings ? (
                  // On settings pages: Dashboard, Home, Sign Out
                  <>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/dashboard'}
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-200"
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5" />
                      Dashboard
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-200"
                    >
                      <Home className="mr-3 h-5 w-5" />
                      Home
                    </Link>
                  </>
                ) : (
                  // On home page only: Dashboard, Settings, Sign Out
                  <>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/dashboard'}
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-200"
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5" />
                      Dashboard
                    </Link>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}/settings` : '/dashboard'}
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-200"
                    >
                      <Settings className="mr-3 h-5 w-5" />
                      Settings
                    </Link>
                  </>
                )}
                <div className="w-px h-8 bg-border mx-2"></div>
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="flex items-center px-4 py-3 text-base font-medium text-destructive hover:text-destructive hover:bg-destructive/10 rounded-md transition-all duration-200"
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  Sign Out
                </Button>
              </div>
            ) : (
              // Not signed in navigation - modern SaaS style
              <div className="flex items-center space-x-2">
                <Link
                  href="/"
                  className={`px-4 py-3 text-base font-medium rounded-md transition-all duration-200 ${textClasses}`}
                >
                  Home
                </Link>
                <Link
                  href="#features"
                  className={`px-4 py-3 text-base font-medium rounded-md transition-all duration-200 ${textClasses}`}
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className={`px-4 py-3 text-base font-medium rounded-md transition-all duration-200 ${textClasses}`}
                >
                  Pricing
                </Link>
                <div className={`w-px h-8 mx-2 ${borderClasses}`}></div>
                <Button
                  onClick={() => router.push('/sign-in')}
                  className={`px-6 py-3 text-base font-medium rounded-md transition-all duration-200 shadow-sm ${primaryButtonClasses}`}
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
              className="p-3 text-foreground hover:text-primary hover:bg-accent rounded-md"
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
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {isAuthenticated ? (
              // Signed in mobile navigation
              <>
                {(isOnDashboard || isOnQRPage) ? (
                  <>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-lg font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-4 h-6 w-6" />
                      Home
                    </Link>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}/settings` : '/dashboard'}
                      className="flex items-center px-4 py-3 text-lg font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="mr-4 h-6 w-6" />
                      Settings
                    </Link>
                  </>
                ) : isOnSettings ? (
                  <>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/dashboard'}
                      className="flex items-center px-4 py-3 text-lg font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-4 h-6 w-6" />
                      Dashboard
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-lg font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-4 h-6 w-6" />
                      Home
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/dashboard'}
                      className="flex items-center px-4 py-3 text-lg font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-4 h-6 w-6" />
                      Dashboard
                    </Link>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}/settings` : '/dashboard'}
                      className="flex items-center px-4 py-3 text-lg font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="mr-4 h-6 w-6" />
                      Settings
                    </Link>
                  </>
                )}
                <div className="w-full h-px bg-border my-2"></div>
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="flex items-center w-full px-4 py-3 text-lg font-medium text-destructive hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                >
                  <LogOut className="mr-4 h-6 w-6" />
                  Sign Out
                </Button>
              </>
            ) : (
              // Not signed in mobile navigation
              <>
                <Link
                  href="/"
                  className="block px-4 py-3 text-lg font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="#features"
                  className="block px-4 py-3 text-lg font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className="block px-4 py-3 text-lg font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <div className="w-full h-px bg-border my-2"></div>
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push('/sign-in');
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 text-lg font-medium rounded-md transition-all duration-200 shadow-sm"
                >
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
} 
