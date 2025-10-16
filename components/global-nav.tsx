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

  // Hide GlobalNav on dashboard pages (we use RoleBasedNavigation instead)
  const isOnDashboard = pathname?.startsWith('/dashboard');
  if (isOnDashboard) {
    return null;
  }

  // Prefer NOT flashing the unauthenticated header. Treat the user as
  // potentially authenticated while loading and only show public actions
  // when we definitively know there is no session.
  const isAuthenticated = !!session?.user && !!session?.access_token;
  const isLoadingAuth = !!loading;

  // Determine if we're on an authenticated route that supports dark mode
  const isAuthenticatedRoute = pathname?.startsWith('/dashboard') || 
                               pathname?.startsWith('/settings') ||
                               pathname?.startsWith('/complete-profile') ||
                               pathname?.startsWith('/sign-in') ||
                               pathname?.startsWith('/sign-up');

  // If we're on an authenticated route, suppress public-only actions even if
  // the auth state is still loading to avoid the "Sign In" flash.
  const shouldHidePublicActions = isAuthenticatedRoute || isLoadingAuth;

  // Use theme-aware colors for authenticated routes, light mode colors for public pages
  const navClasses = isAuthenticatedRoute 
    ? "bg-background border-b border-border shadow-sm sticky top-0 z-50"
    : "bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50";

  const textClasses = isAuthenticatedRoute
    ? "text-foreground hover:text-primary hover:bg-accent"
    : "text-foreground/80 hover:text-foreground hover:bg-accent";

  const borderClasses = isAuthenticatedRoute
    ? "border-border"
    : "border-gray-200";

  const primaryButtonClasses = isAuthenticatedRoute
    ? "bg-white text-servio-purple border-2 border-servio-purple hover:bg-gray-50 hover:text-servio-purple-dark"
    : "bg-white text-servio-purple border-2 border-servio-purple hover:bg-gray-50 hover:text-servio-purple-dark";


  // Determine if we're on dashboard pages
  const isOnDashboard = pathname?.startsWith('/dashboard');
  const isOnHomePage = pathname === '/';
  const isOnSettings = pathname?.includes('/settings');
  const isOnQRPage = pathname?.includes('/qr-codes');
  
  // Check if we're on the dashboard root page (not a feature page)
  const isDashboardRoot = pathname?.match(/^\/dashboard\/(?:[^/]+)\/?$/);
  const isOnFeaturePage = isOnDashboard && !isDashboardRoot;
  
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
            .eq('owner_user_id', session.user.id)
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

  // Always render navigation immediately - don't wait for auth loading
  // The navigation will show appropriate content based on auth state

  return (
    <nav className={navClasses}>
      <div className="w-full px-2 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-20 sm:h-24 md:h-28">
          {/* Logo - Top-left on desktop, centered on mobile */}
          <div className="flex-shrink-0 md:-ml-2 sm:-ml-1 flex justify-center md:justify-start w-full md:w-auto">
            <Link href={isAuthenticated ? (venueId ? `/dashboard/${venueId}` : (primaryVenueId ? `/dashboard/${primaryVenueId}` : "/")) : "/"} className="flex items-center group">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={800}
                height={250}
                className="h-[120px] sm:h-[140px] md:h-[160px] lg:h-[180px] xl:h-[200px] w-auto transition-all duration-300 group-hover:scale-105"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation - Properly spaced from right edge */}
          <div className="hidden md:flex items-center space-x-2 pr-4">
            {isAuthenticated ? (
              // Signed in navigation - modern SaaS style
              <div className="flex items-center space-x-2">
                {isDashboardRoot ? (
                  // On dashboard root page: Home, Settings, Sign Out
                  <>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-200"
                    >
                      <Home className="mr-3 h-5 w-5" />
                      Home
                    </Link>
                    <Link
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}/settings` : '/'}
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-200"
                    >
                      <Settings className="mr-3 h-5 w-5" />
                      Settings
                    </Link>
                  </>
                ) : (isOnFeaturePage || isOnQRPage) ? (
                  // On feature pages (Live Orders, Menu, etc.) and QR pages: Dashboard, Settings, Sign Out
                  <>
                    <Link
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}` : '/'}
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-200"
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5" />
                      Dashboard
                    </Link>
                    <Link
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}/settings` : '/'}
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
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}` : '/'}
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
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}` : '/'}
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-200"
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5" />
                      Dashboard
                    </Link>
                    <Link
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}/settings` : '/'}
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-md transition-all duration-200"
                    >
                      <Settings className="mr-3 h-5 w-5" />
                      Settings
                    </Link>
                  </>
                )}
                <div className="w-px h-8 bg-border mx-2"></div>
                <Button
                  variant="destructive"
                  onClick={handleSignOut}
                  className="flex items-center px-4 py-3 text-base font-medium bg-red-600 text-white hover:bg-red-700 rounded-md transition-all duration-200"
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  Sign Out
                </Button>
              </div>
            ) : shouldHidePublicActions ? null : (
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
                  variant="servio"
                  size="lg"
                >
                  Sign In
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button - Positioned absolutely on the right */}
          <div className="absolute right-0 md:hidden">
            <Button
              variant="ghost"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 sm:p-3 text-foreground hover:text-primary hover:bg-accent rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : (
                <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white/95 backdrop-blur-md shadow-lg">
          <div className="px-4 pt-4 pb-6 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {isAuthenticated ? (
              // Signed in mobile navigation
              <>
                {isDashboardRoot ? (
                  <>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Home</span>
                    </Link>
                    <Link
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}/settings` : '/'}
                      className="flex items-center px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Settings</span>
                    </Link>
                  </>
                ) : (isOnFeaturePage || isOnQRPage) ? (
                  <>
                    <Link
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}` : '/'}
                      className="flex items-center px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}/settings` : '/'}
                      className="flex items-center px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Settings</span>
                    </Link>
                  </>
                ) : isOnSettings ? (
                  <>
                    <Link
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}` : '/'}
                      className="flex items-center px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Home</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}` : '/'}
                      className="flex items-center px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      href={(venueId || primaryVenueId) ? `/dashboard/${venueId || primaryVenueId}/settings` : '/'}
                      className="flex items-center px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Settings</span>
                    </Link>
                  </>
                )}
                <div className="w-full h-px bg-gray-100 my-4"></div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full px-4 py-3 text-base font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all duration-200 min-h-[48px] justify-start"
                >
                  <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-white" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              // Not signed in mobile navigation
              <>
                <Link
                  href="/"
                  className="block px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="#features"
                  className="block px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className="block px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <div className="w-full h-px bg-gray-100 my-4"></div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push('/sign-in');
                  }}
                  className="w-full px-4 py-3 text-base font-semibold text-white bg-servio-purple hover:bg-servio-purple-dark rounded-xl transition-all duration-200 min-h-[48px] flex items-center justify-center"
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
} 
