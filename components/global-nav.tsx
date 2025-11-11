"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { Menu, X, Settings, Home, LayoutDashboard, LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";

export default function GlobalNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { session, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  // SYNCHRONOUS auth state - no useState, no useEffect delays
  // This prevents ALL flicker by using session from context immediately
  const isAuthenticated = !!(session?.user && session?.access_token);

  // SYNCHRONOUS cached data extraction - happens during render, not in state
  const getCachedData = () => {
    if (typeof window === "undefined" || !session?.user?.id) {
      return { primaryVenueId: null, userRole: null };
    }
    const userId = session.user.id;
    const cachedRole = sessionStorage.getItem(`user_role_${userId}`);
    const cachedVenueId = sessionStorage.getItem(`venue_id_${userId}`);
    return { primaryVenueId: cachedVenueId, userRole: cachedRole };
  };

  // Use synchronous values, not state - prevents re-render flicker
  const cachedData = getCachedData();
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(cachedData.primaryVenueId);
  const [userRole, setUserRole] = useState<string | null>(cachedData.userRole);

  // Determine if we're on an authenticated route that supports dark mode
  const isAuthenticatedRoute =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/settings") ||
    pathname?.startsWith("/complete-profile") ||
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up");

  // Check if on home page
  const isOnHomePage = pathname === "/" || pathname === "/home";

  // Use session from auth context - already initialized from server
  // This prevents flicker because the session is available immediately
  const shouldHidePublicActions = isAuthenticatedRoute || isAuthenticated;

  // Use theme-aware colors for authenticated routes, light mode colors for public pages
  const navClasses = isAuthenticatedRoute
    ? "bg-background border-b border-border shadow-sm sticky top-0 z-50"
    : "bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50";

  const textClasses = isAuthenticatedRoute
    ? "text-foreground hover:text-primary hover:bg-accent"
    : "text-foreground/80 hover:text-foreground hover:bg-accent";

  const borderClasses = isAuthenticatedRoute ? "border-border" : "border-gray-200";

  // Determine if we're on dashboard pages
  const isOnDashboard = pathname?.startsWith("/dashboard");
  const isOnSettings = pathname?.includes("/settings");
  const isOnQRPage = pathname?.includes("/qr-codes");

  // Check if on home page
  const isHomePage = pathname === "/" || pathname === "/home";

  // Check if we're on the dashboard root page (not a feature page)
  const isDashboardRoot = pathname?.match(/^\/dashboard\/(?:[^/]+)\/?$/);
  const isOnFeaturePage = isOnDashboard && !isDashboardRoot;

  // Extract venueId from pathname for venue-specific navigation
  const venueId = pathname?.match(/\/dashboard\/([^/]+)/)?.[1];

  // Fetch primary venue and user role when user is signed in
  useEffect(() => {
    const fetchUserData = async () => {
      if (isAuthenticated && session?.user?.id) {
        try {
          // Check if we already have cached data (set in useState initialization)
          const cachedRole = sessionStorage.getItem(`user_role_${session.user.id}`);
          const cachedVenueId = sessionStorage.getItem(`venue_id_${session.user.id}`);

          if (cachedRole && cachedVenueId) {
            // Already set in useState, no need to fetch
            return;
          }

          // No cache - fetch role data
          const [venueResult, staffResult] = await Promise.all([
            supabase
              .from("venues")
              .select("venue_id")
              .eq("owner_user_id", session.user.id)
              .order("created_at", { ascending: true })
              .limit(1),
            supabase
              .from("user_venue_roles")
              .select("role, venue_id")
              .eq("user_id", session.user.id)
              .limit(1)
              .single(),
          ]);

          if (
            !venueResult.error &&
            Array.isArray(venueResult.data) &&
            venueResult.data.length > 0 &&
            venueResult.data[0]?.venue_id
          ) {
            setPrimaryVenueId(venueResult.data[0].venue_id);
            setUserRole("owner");
            // Cache the data
            sessionStorage.setItem(`user_role_${session.user.id}`, "owner");
            sessionStorage.setItem(`venue_id_${session.user.id}`, venueResult.data[0].venue_id);
          } else if (!staffResult.error && staffResult.data?.venue_id && staffResult.data?.role) {
            setPrimaryVenueId(staffResult.data.venue_id);
            setUserRole(staffResult.data.role);
            // Cache the data
            sessionStorage.setItem(`user_role_${session.user.id}`, staffResult.data.role);
            sessionStorage.setItem(`venue_id_${session.user.id}`, staffResult.data.venue_id);
          }
        } catch (_error) {
          // Error handled silently
        }
      } else if (!isAuthenticated) {
        // Clear state and cached data when not authenticated
        setPrimaryVenueId(null);
        setUserRole(null);
        // Clear all cached user data from session storage
        if (typeof window !== "undefined") {
          const keys = Object.keys(sessionStorage);
          keys.forEach((key) => {
            if (key.startsWith("user_role_") || key.startsWith("venue_id_")) {
              sessionStorage.removeItem(key);
            }
          });
        }
      }
    };

    fetchUserData();
  }, [session?.user?.id, supabase, isAuthenticated]);

  // Always render navigation immediately - don't wait for auth loading
  // The navigation will show appropriate content based on auth state

  // Render nav instantly - no waiting for auth
  return (
    <nav className={navClasses}>
      <div className="w-full px-2 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-20 sm:h-24 md:h-28">
          {/* Logo - Top-left on desktop, centered on mobile */}
          <div className="flex-shrink-0 md:-ml-2 sm:-ml-1 flex justify-center md:justify-start w-full md:w-auto">
            <Link href="/" className="inline-block group">
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
                  // On dashboard root page: Home, Settings, Dark Mode (no border), Sign Out (purple border)
                  <>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-purple-600 transition-all duration-200"
                    >
                      <Home className="mr-3 h-5 w-5" />
                      Home
                    </Link>
                    {(!userRole || userRole === "owner" || userRole === "manager") && (
                      <Link
                        href={
                          venueId || primaryVenueId
                            ? `/dashboard/${venueId || primaryVenueId}/settings`
                            : "/"
                        }
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-purple-600 transition-all duration-200"
                      >
                        <Settings className="mr-3 h-5 w-5" />
                        Settings
                      </Link>
                    )}
                    <button
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-purple-600 transition-all duration-200"
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? (
                        <Sun className="h-5 w-5" />
                      ) : (
                        <Moon className="h-5 w-5" />
                      )}
                    </button>
                    <div className="w-px h-8 bg-gray-200 mx-2"></div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await signOut();
                        router.replace("/");
                      }}
                      className="flex items-center px-4 py-3 text-base font-medium bg-white text-purple-600 border-2 border-purple-600 hover:bg-purple-600 hover:text-white rounded-md transition-all duration-200"
                    >
                      <LogOut className="mr-3 h-5 w-5" />
                      Sign Out
                    </Button>
                  </>
                ) : isOnFeaturePage || isOnQRPage ? (
                  // On feature pages: Dashboard, Settings, Dark Mode (no border), Sign Out (purple border)
                  <>
                    <Link
                      href={
                        venueId || primaryVenueId ? `/dashboard/${venueId || primaryVenueId}` : "/"
                      }
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-purple-600 transition-all duration-200"
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5" />
                      Dashboard
                    </Link>
                    {(!userRole || userRole === "owner" || userRole === "manager") && (
                      <Link
                        href={
                          venueId || primaryVenueId
                            ? `/dashboard/${venueId || primaryVenueId}/settings`
                            : "/"
                        }
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-purple-600 transition-all duration-200"
                      >
                        <Settings className="mr-3 h-5 w-5" />
                        Settings
                      </Link>
                    )}
                    <button
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-purple-600 transition-all duration-200"
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? (
                        <Sun className="h-5 w-5" />
                      ) : (
                        <Moon className="h-5 w-5" />
                      )}
                    </button>
                    <div className="w-px h-8 bg-gray-200 mx-2"></div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await signOut();
                        router.replace("/");
                      }}
                      className="flex items-center px-4 py-3 text-base font-medium bg-white text-purple-600 border-2 border-purple-600 hover:bg-purple-600 hover:text-white rounded-md transition-all duration-200"
                    >
                      <LogOut className="mr-3 h-5 w-5" />
                      Sign Out
                    </Button>
                  </>
                ) : isOnSettings ? (
                  // On settings pages: Dashboard, Home (no border), Sign Out (purple border)
                  <>
                    <Link
                      href={
                        venueId || primaryVenueId ? `/dashboard/${venueId || primaryVenueId}` : "/"
                      }
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-purple-600 transition-all duration-200"
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5" />
                      Dashboard
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-purple-600 transition-all duration-200"
                    >
                      <Home className="mr-3 h-5 w-5" />
                      Home
                    </Link>
                    {/* NO DARK MODE BUTTON ON SETTINGS PAGES - hidden on home page */}
                    <div className="w-px h-8 bg-gray-200 mx-2"></div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await signOut();
                        router.replace("/");
                      }}
                      className="flex items-center px-4 py-3 text-base font-medium bg-white text-purple-600 border-2 border-purple-600 hover:bg-purple-600 hover:text-white rounded-md transition-all duration-200"
                    >
                      <LogOut className="mr-3 h-5 w-5" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  // On home page: Dashboard, Settings (no border), Sign Out (purple border) - NO dark mode
                  // Only show Dashboard button if user has a venue (owner or staff)
                  <>
                    {(venueId || primaryVenueId) && (
                      <Link
                        href={`/dashboard/${venueId || primaryVenueId}`}
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-purple-600 transition-all duration-200"
                      >
                        <LayoutDashboard className="mr-3 h-5 w-5" />
                        Dashboard
                      </Link>
                    )}
                    {(!userRole || userRole === "owner" || userRole === "manager") && (
                      <Link
                        href={
                          venueId || primaryVenueId
                            ? `/dashboard/${venueId || primaryVenueId}/settings`
                            : "/"
                        }
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-purple-600 transition-all duration-200"
                      >
                        <Settings className="mr-3 h-5 w-5" />
                        Settings
                      </Link>
                    )}
                    {/* NO DARK MODE TOGGLE ON HOME PAGE */}
                    <div className="w-px h-8 bg-gray-200 mx-2"></div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await signOut();
                        router.replace("/");
                      }}
                      className="flex items-center px-4 py-3 text-base font-medium bg-white text-purple-600 border-2 border-purple-600 hover:bg-purple-600 hover:text-white rounded-md transition-all duration-200"
                    >
                      <LogOut className="mr-3 h-5 w-5" />
                      Sign Out
                    </Button>
                  </>
                )}
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
                <Button onClick={() => router.push("/sign-in")} variant="servio" size="lg">
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
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Home</span>
                    </Link>
                    {(!userRole || userRole === "owner" || userRole === "manager") && (
                      <Link
                        href={
                          venueId || primaryVenueId
                            ? `/dashboard/${venueId || primaryVenueId}/settings`
                            : "/"
                        }
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Settings className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                        <span>Settings</span>
                      </Link>
                    )}
                    {!isHomePage && (
                      <button
                        onClick={() => {
                          const currentTheme = theme || "light";
                          setTheme(currentTheme === "dark" ? "light" : "dark");
                        }}
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] w-full"
                      >
                        {theme === "dark" ? (
                          <>
                            <Sun className="mr-3 h-5 w-5 flex-shrink-0 text-yellow-500" />
                            <span>Light Mode</span>
                          </>
                        ) : (
                          <>
                            <Moon className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                            <span>Dark Mode</span>
                          </>
                        )}
                      </button>
                    )}
                    <div className="w-full h-px bg-gray-100 my-4"></div>
                    <button
                      onClick={async () => {
                        await signOut();
                        setMobileMenuOpen(false);
                        router.replace("/");
                      }}
                      className="flex items-center w-full px-4 py-3 text-base font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all duration-200 min-h-[48px] justify-start"
                    >
                      <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-white" />
                      <span>Sign Out</span>
                    </button>
                  </>
                ) : isOnFeaturePage || isOnQRPage ? (
                  <>
                    <Link
                      href={
                        venueId || primaryVenueId ? `/dashboard/${venueId || primaryVenueId}` : "/"
                      }
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Dashboard</span>
                    </Link>
                    {(!userRole || userRole === "owner" || userRole === "manager") && (
                      <Link
                        href={
                          venueId || primaryVenueId
                            ? `/dashboard/${venueId || primaryVenueId}/settings`
                            : "/"
                        }
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Settings className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                        <span>Settings</span>
                      </Link>
                    )}
                    {!isHomePage && (
                      <button
                        onClick={() => {
                          const currentTheme = theme || "light";
                          setTheme(currentTheme === "dark" ? "light" : "dark");
                        }}
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] w-full"
                      >
                        {theme === "dark" ? (
                          <>
                            <Sun className="mr-3 h-5 w-5 flex-shrink-0 text-yellow-500" />
                            <span>Light Mode</span>
                          </>
                        ) : (
                          <>
                            <Moon className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                            <span>Dark Mode</span>
                          </>
                        )}
                      </button>
                    )}
                    <div className="w-full h-px bg-gray-100 my-4"></div>
                    <button
                      onClick={async () => {
                        await signOut();
                        setMobileMenuOpen(false);
                        router.replace("/");
                      }}
                      className="flex items-center w-full px-4 py-3 text-base font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all duration-200 min-h-[48px] justify-start"
                    >
                      <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-white" />
                      <span>Sign Out</span>
                    </button>
                  </>
                ) : isOnSettings ? (
                  <>
                    <Link
                      href={
                        venueId || primaryVenueId ? `/dashboard/${venueId || primaryVenueId}` : "/"
                      }
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Dashboard</span>
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Home</span>
                    </Link>
                    {!isHomePage && (
                      <button
                        onClick={() => {
                          const currentTheme = theme || "light";
                          setTheme(currentTheme === "dark" ? "light" : "dark");
                        }}
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] w-full"
                      >
                        {theme === "dark" ? (
                          <>
                            <Sun className="mr-3 h-5 w-5 flex-shrink-0 text-yellow-500" />
                            <span>Light Mode</span>
                          </>
                        ) : (
                          <>
                            <Moon className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                            <span>Dark Mode</span>
                          </>
                        )}
                      </button>
                    )}
                    <div className="w-full h-px bg-gray-100 my-4"></div>
                    <button
                      onClick={async () => {
                        await signOut();
                        setMobileMenuOpen(false);
                        router.replace("/");
                      }}
                      className="flex items-center w-full px-4 py-3 text-base font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all duration-200 min-h-[48px] justify-start"
                    >
                      <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-white" />
                      <span>Sign Out</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href={
                        venueId || primaryVenueId ? `/dashboard/${venueId || primaryVenueId}` : "/"
                      }
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                      <span>Dashboard</span>
                    </Link>
                    {(!userRole || userRole === "owner" || userRole === "manager") && (
                      <Link
                        href={
                          venueId || primaryVenueId
                            ? `/dashboard/${venueId || primaryVenueId}/settings`
                            : "/"
                        }
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Settings className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900" />
                        <span>Settings</span>
                      </Link>
                    )}
                    {/* Dark mode button hidden on home page */}
                    <div className="w-full h-px bg-gray-100 my-4"></div>
                    <button
                      onClick={async () => {
                        await signOut();
                        setMobileMenuOpen(false);
                        router.replace("/");
                      }}
                      className="flex items-center w-full px-4 py-3 text-base font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all duration-200 min-h-[48px] justify-start"
                    >
                      <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-white" />
                      <span>Sign Out</span>
                    </button>
                  </>
                )}
              </>
            ) : (
              // Not signed in mobile navigation
              <>
                <Link
                  href="/"
                  className="px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="#features"
                  className="px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className="px-4 py-3 text-base font-semibold text-gray-900 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <div className="w-full h-px bg-gray-100 my-4"></div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push("/sign-in");
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
