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


  // Show authenticated navigation if we have a session, even if still loading
  // This prevents the flash of unauthenticated content
  const isAuthenticated = !!session?.user && !!session?.access_token;

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

  // Always render navigation immediately - don't wait for auth loading
  // The navigation will show appropriate content based on auth state

  return (
    <nav className={navClasses}>
      <div className="w-full px-2 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-20 sm:h-24 md:h-28">
          {/* Logo - Large and prominent */}
          <div className="flex-shrink-0 -ml-2 sm:-ml-1">
            <Link href={isAuthenticated ? (venueId ? `/dashboard/${venueId}` : "/dashboard") : "/"} className="flex items-center group">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={800}
                height={250}
                className="h-16 sm:h-20 md:h-24 lg:h-28 xl:h-32 w-auto transition-all duration-300 group-hover:scale-105"
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
        <div className="md:hidden border-t border-border bg-background shadow-lg">
          <div className="px-3 pt-3 pb-4 space-y-2 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {isAuthenticated ? (
              // Signed in mobile navigation
              <>
                {(isOnDashboard || isOnQRPage) ? (
                  <>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-4 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-3 h-5 w-5 flex-shrink-0" />
                      <span>Home</span>
                    </Link>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}/settings` : '/dashboard'}
                      className="flex items-center px-4 py-4 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="mr-3 h-5 w-5 flex-shrink-0" />
                      <span>Settings</span>
                    </Link>
                  </>
                ) : isOnSettings ? (
                  <>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/dashboard'}
                      className="flex items-center px-4 py-4 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0" />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-4 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-3 h-5 w-5 flex-shrink-0" />
                      <span>Home</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}` : '/dashboard'}
                      className="flex items-center px-4 py-4 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0" />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      href={primaryVenueId ? `/dashboard/${primaryVenueId}/settings` : '/dashboard'}
                      className="flex items-center px-4 py-4 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Settings className="mr-3 h-5 w-5 flex-shrink-0" />
                      <span>Settings</span>
                    </Link>
                  </>
                )}
                <div className="w-full h-px bg-border my-3"></div>
                <Button
                  variant="ghost"
                  onClick={handleSignOut}
                  className="flex items-center w-full px-4 py-4 text-base font-medium text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors min-h-[48px] justify-start"
                >
                  <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span>Sign Out</span>
                </Button>
              </>
            ) : (
              // Not signed in mobile navigation
              <>
                <Link
                  href="/"
                  className="block px-4 py-4 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="#features"
                  className="block px-4 py-4 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className="block px-4 py-4 text-base font-medium text-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <div className="w-full h-px bg-border my-3"></div>
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push('/sign-in');
                  }}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-4 text-base font-medium rounded-lg transition-all duration-200 shadow-sm min-h-[48px]"
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
