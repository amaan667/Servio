"use client";

import { useState } from "react";
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
  const { session, signOut, primaryVenueId, userRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  // SYNCHRONOUS auth state - no useState, no useEffect delays
  // This prevents ALL flicker by using session from context immediately
  // Check for user existence since server-side sessions may not have access_token
  const isAuthenticated = !!session?.user;

  // Venue data now comes from AuthProvider - no local state needed

  // Determine if we're on an authenticated route that supports dark mode
  const isAuthenticatedRoute =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/settings") ||
    pathname?.startsWith("/complete-profile") ||
    pathname?.startsWith("/sign-in") ||
    pathname?.startsWith("/sign-up");

  // Use session from auth context - already initialized from server
  // This prevents flicker because the session is available immediately
  const shouldHidePublicActions = isAuthenticatedRoute || isAuthenticated;

  // Use theme-aware colors for all routes
  const navClasses =
    "bg-background dark:bg-background border-b border-border dark:border-border shadow-sm sticky top-0 z-50";

  const textClasses =
    "text-foreground hover:text-primary dark:hover:text-primary hover:bg-accent dark:hover:bg-accent";

  const borderClasses = "border-border dark:border-border";

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

  // Venue data now comes from AuthProvider - no fetching needed

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
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground dark:text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                      onClick={() => {
                        // Home button clicked - no action needed
                      }}
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
                        className="flex items-center px-4 py-3 text-base font-medium text-foreground dark:text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                      >
                        <Settings className="mr-3 h-5 w-5" />
                        Settings
                      </Link>
                    )}
                    <button
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-purple-600 transition-all duration-200"
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? (
                        <Sun className="h-5 w-5 text-foreground" />
                      ) : (
                        <Moon className="h-5 w-5 text-foreground" />
                      )}
                    </button>
                    <div className="w-px h-8 bg-border mx-2"></div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          // Clear client state first (prevents flash of authenticated content)
                          await signOut();
                          // Call server API to ensure cookies are cleared
                          await fetch("/api/auth/signout", {
                            method: "POST",
                            credentials: "include",
                          }).catch(() => {});
                          // Force full page reload to clear any cached state
                          window.location.href = "/";
                        } catch {
                          window.location.href = "/";
                        }
                      }}
                      className="flex items-center px-4 py-3 text-base font-medium"
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
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground dark:text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                      onClick={() => {
                        const href =
                          venueId || primaryVenueId
                            ? `/dashboard/${venueId || primaryVenueId}`
                            : "/";

                        // Track navigation attempt
                        const startTime = Date.now();
                        const navigationId = `nav-${Date.now()}-${Math.random().toString(36).substring(7)}`;

                        // Log navigation start

                        // Monitor if navigation actually happens
                        setTimeout(() => {
                          const elapsed = Date.now() - startTime;
                          const currentPath = window.location.pathname;
                        }, 100);
                      }}
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
                        className="flex items-center px-4 py-3 text-base font-medium text-foreground dark:text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                      >
                        <Settings className="mr-3 h-5 w-5" />
                        Settings
                      </Link>
                    )}
                    <button
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-purple-600 transition-all duration-200"
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? (
                        <Sun className="h-5 w-5 text-foreground" />
                      ) : (
                        <Moon className="h-5 w-5 text-foreground" />
                      )}
                    </button>
                    <div className="w-px h-8 bg-border mx-2"></div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          // Clear client state first (prevents flash of authenticated content)
                          await signOut();
                          // Call server API to ensure cookies are cleared
                          await fetch("/api/auth/signout", {
                            method: "POST",
                            credentials: "include",
                          }).catch(() => {});
                          // Force full page reload to clear any cached state
                          window.location.href = "/";
                        } catch {
                          window.location.href = "/";
                        }
                      }}
                      className="flex items-center px-4 py-3 text-base font-medium"
                    >
                      <LogOut className="mr-3 h-5 w-5" />
                      Sign Out
                    </Button>
                  </>
                ) : isOnSettings ? (
                  // On settings pages: Dashboard, Home, Dark Mode (no border), Sign Out (purple border)
                  <>
                    <Link
                      href={
                        venueId || primaryVenueId ? `/dashboard/${venueId || primaryVenueId}` : "/"
                      }
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground dark:text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                      onClick={() => {
                        const href =
                          venueId || primaryVenueId
                            ? `/dashboard/${venueId || primaryVenueId}`
                            : "/";

                        // Track navigation attempt
                        const startTime = Date.now();
                        const navigationId = `nav-${Date.now()}-${Math.random().toString(36).substring(7)}`;

                        // Monitor if navigation actually happens
                        setTimeout(() => {
                          const elapsed = Date.now() - startTime;
                          const currentPath = window.location.pathname;
                        }, 100);
                      }}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5" />
                      Dashboard
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground dark:text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                    >
                      <Home className="mr-3 h-5 w-5" />
                      Home
                    </Link>
                    <button
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="flex items-center px-4 py-3 text-base font-medium text-foreground hover:text-purple-600 transition-all duration-200"
                      aria-label="Toggle theme"
                    >
                      {theme === "dark" ? (
                        <Sun className="h-5 w-5 text-foreground" />
                      ) : (
                        <Moon className="h-5 w-5 text-foreground" />
                      )}
                    </button>
                    <div className="w-px h-8 bg-border mx-2"></div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          // Clear client state first (prevents flash of authenticated content)
                          await signOut();
                          // Call server API to ensure cookies are cleared
                          await fetch("/api/auth/signout", {
                            method: "POST",
                            credentials: "include",
                          }).catch(() => {});
                          // Force full page reload to clear any cached state
                          window.location.href = "/";
                        } catch {
                          window.location.href = "/";
                        }
                      }}
                      className="flex items-center px-4 py-3 text-base font-medium"
                    >
                      <LogOut className="mr-3 h-5 w-5" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  // On home page: Dashboard, Settings (no border), Sign Out (purple border) - NO dark mode
                  // Show Dashboard button if user has a venue (owner or staff)
                  <>
                    {(venueId || primaryVenueId) && (
                      <Link
                        href={`/dashboard/${venueId || primaryVenueId}`}
                        className="flex items-center px-4 py-3 text-base font-medium text-foreground dark:text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                        onClick={() => {
                          const href = `/dashboard/${venueId || primaryVenueId}`;

                          // Track navigation attempt
                          const startTime = Date.now();
                          const navigationId = `nav-${Date.now()}-${Math.random().toString(36).substring(7)}`;

                          // Monitor if navigation actually happens
                          setTimeout(() => {
                            const elapsed = Date.now() - startTime;
                            const currentPath = window.location.pathname;

                            // If navigation didn't happen, log warning
                            if (currentPath !== href && !currentPath.startsWith(href)) {
                              // Navigation failed - handled by longer timeout check
                            }
                          }, 100);

                          // Also check after longer delay
                          setTimeout(() => {
                            const currentPath = window.location.pathname;
                            if (currentPath !== href && !currentPath.startsWith(href)) {
                              if (
                                typeof window !== "undefined" &&
                                (window as { Sentry?: unknown }).Sentry
                              ) {
                                (
                                  window as {
                                    Sentry: {
                                      captureMessage: (msg: string, level?: string) => void;
                                    };
                                  }
                                ).Sentry.captureMessage?.(
                                  `Navigation to ${href} did not occur (1s delay). Current path: ${currentPath}`,
                                  "warning"
                                );
                              }
                            }
                          }, 1000);
                        }}
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
                        className="flex items-center px-4 py-3 text-base font-medium text-foreground dark:text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200"
                      >
                        <Settings className="mr-3 h-5 w-5" />
                        Settings
                      </Link>
                    )}
                    {/* NO DARK MODE TOGGLE ON HOME PAGE */}
                    <div className="w-px h-8 bg-border mx-2"></div>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          // Clear client state first (prevents flash of authenticated content)
                          await signOut();
                          // Call server API to ensure cookies are cleared
                          await fetch("/api/auth/signout", {
                            method: "POST",
                            credentials: "include",
                          }).catch(() => {});
                          // Force full page reload to clear any cached state
                          window.location.href = "/";
                        } catch {
                          window.location.href = "/";
                        }
                      }}
                      className="flex items-center px-4 py-3 text-base font-medium"
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

          {/* Mobile menu button - Positioned absolutely on the right - Grey with purple border like bottom menu */}
          <div className="absolute right-0 md:hidden">
            <Button
              variant="ghost"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 sm:p-3 bg-transparent border-0 text-gray-500 dark:text-gray-400 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center mobile-menu-button"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 sm:h-6 sm:w-6 text-gray-500 dark:text-gray-400" />
              ) : (
                <Menu className="h-5 w-5 sm:h-6 sm:w-6 text-gray-500 dark:text-gray-400" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-white dark:bg-gray-900 shadow-lg z-50 mobile-dropdown-menu">
          <div className="px-4 pt-4 pb-6 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {isAuthenticated ? (
              // Signed in mobile navigation
              <>
                {isDashboardRoot ? (
                  <>
                    <Link
                      href={
                        venueId || primaryVenueId ? `/dashboard/${venueId || primaryVenueId}` : "/"
                      }
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 dark:text-gray-100 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900 dark:text-gray-100" />
                      <span className="text-gray-900 dark:text-gray-100">Home</span>
                    </Link>
                    {(!userRole || userRole === "owner" || userRole === "manager") && (
                      <Link
                        href={
                          venueId || primaryVenueId
                            ? `/dashboard/${venueId || primaryVenueId}/settings`
                            : "/"
                        }
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 dark:text-gray-100 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Settings className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900 dark:text-gray-100" />
                        <span className="text-gray-900 dark:text-gray-100">Settings</span>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        const currentTheme = theme || "light";
                        setTheme(currentTheme === "dark" ? "light" : "dark");
                      }}
                      className="flex items-center px-4 py-3 text-base font-medium bg-servio-purple text-white hover:bg-white hover:text-servio-purple rounded-xl transition-all duration-200 min-h-[48px] w-full border-2 border-servio-purple"
                    >
                      {theme === "dark" ? (
                        <>
                          <Sun className="mr-3 h-5 w-5 flex-shrink-0 text-white group-hover:text-servio-purple" />
                          <span className="text-white group-hover:text-servio-purple">
                            Light Mode
                          </span>
                        </>
                      ) : (
                        <>
                          <Moon className="mr-3 h-5 w-5 flex-shrink-0 text-white group-hover:text-servio-purple" />
                          <span className="text-white group-hover:text-servio-purple">
                            Dark Mode
                          </span>
                        </>
                      )}
                    </button>
                    <div className="w-full h-px bg-border my-4"></div>
                    <button
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        try {
                          // Clear client state first (prevents flash of authenticated content)
                          await signOut();
                          // Call server API to ensure cookies are cleared
                          await fetch("/api/auth/signout", {
                            method: "POST",
                            credentials: "include",
                          }).catch(() => {});
                          // Force full page reload to clear any cached state
                          window.location.href = "/";
                        } catch {
                          window.location.href = "/";
                        }
                      }}
                      className="flex items-center w-full px-4 py-3 text-base font-semibold bg-servio-purple text-white hover:bg-white hover:text-servio-purple rounded-xl transition-all duration-200 min-h-[48px] justify-start border-2 border-servio-purple"
                    >
                      <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-white" />
                      <span className="text-white">Sign Out</span>
                    </button>
                  </>
                ) : isOnFeaturePage || isOnQRPage ? (
                  <>
                    <Link
                      href={
                        venueId || primaryVenueId ? `/dashboard/${venueId || primaryVenueId}` : "/"
                      }
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 dark:text-gray-100 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900 dark:text-gray-100" />
                      <span className="text-gray-900 dark:text-gray-100">Dashboard</span>
                    </Link>
                    {(!userRole || userRole === "owner" || userRole === "manager") && (
                      <Link
                        href={
                          venueId || primaryVenueId
                            ? `/dashboard/${venueId || primaryVenueId}/settings`
                            : "/"
                        }
                        className="flex items-center px-4 py-3 text-base font-medium text-gray-900 dark:text-gray-100 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Settings className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900 dark:text-gray-100" />
                        <span className="text-gray-900 dark:text-gray-100">Settings</span>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        const currentTheme = theme || "light";
                        setTheme(currentTheme === "dark" ? "light" : "dark");
                      }}
                      className="flex items-center px-4 py-3 text-base font-medium bg-servio-purple text-white hover:bg-white hover:text-servio-purple rounded-xl transition-all duration-200 min-h-[48px] w-full border-2 border-servio-purple"
                    >
                      {theme === "dark" ? (
                        <>
                          <Sun className="mr-3 h-5 w-5 flex-shrink-0 text-white group-hover:text-servio-purple" />
                          <span className="text-white group-hover:text-servio-purple">
                            Light Mode
                          </span>
                        </>
                      ) : (
                        <>
                          <Moon className="mr-3 h-5 w-5 flex-shrink-0 text-white group-hover:text-servio-purple" />
                          <span className="text-white group-hover:text-servio-purple">
                            Dark Mode
                          </span>
                        </>
                      )}
                    </button>
                    <div className="w-full h-px bg-border my-4"></div>
                    <button
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        try {
                          // Clear client state first (prevents flash of authenticated content)
                          await signOut();
                          // Call server API to ensure cookies are cleared
                          await fetch("/api/auth/signout", {
                            method: "POST",
                            credentials: "include",
                          }).catch(() => {});
                          // Force full page reload to clear any cached state
                          window.location.href = "/";
                        } catch {
                          window.location.href = "/";
                        }
                      }}
                      className="flex items-center w-full px-4 py-3 text-base font-semibold bg-servio-purple text-white hover:bg-white hover:text-servio-purple rounded-xl transition-all duration-200 min-h-[48px] justify-start border-2 border-servio-purple"
                    >
                      <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-white" />
                      <span className="text-white">Sign Out</span>
                    </button>
                  </>
                ) : isOnSettings ? (
                  <>
                    <Link
                      href={
                        venueId || primaryVenueId ? `/dashboard/${venueId || primaryVenueId}` : "/"
                      }
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 dark:text-gray-100 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900 dark:text-gray-100" />
                      <span className="text-gray-900 dark:text-gray-100">Dashboard</span>
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center px-4 py-3 text-base font-medium text-gray-900 dark:text-gray-100 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="mr-3 h-5 w-5 flex-shrink-0 text-gray-900 dark:text-gray-100" />
                      <span className="text-gray-900 dark:text-gray-100">Home</span>
                    </Link>
                    <button
                      onClick={() => {
                        const currentTheme = theme || "light";
                        setTheme(currentTheme === "dark" ? "light" : "dark");
                      }}
                      className="flex items-center px-4 py-3 text-base font-medium bg-servio-purple text-white hover:bg-white hover:text-servio-purple rounded-xl transition-all duration-200 min-h-[48px] w-full border-2 border-servio-purple"
                    >
                      {theme === "dark" ? (
                        <>
                          <Sun className="mr-3 h-5 w-5 flex-shrink-0 text-white group-hover:text-servio-purple" />
                          <span className="text-white group-hover:text-servio-purple">
                            Light Mode
                          </span>
                        </>
                      ) : (
                        <>
                          <Moon className="mr-3 h-5 w-5 flex-shrink-0 text-white group-hover:text-servio-purple" />
                          <span className="text-white group-hover:text-servio-purple">
                            Dark Mode
                          </span>
                        </>
                      )}
                    </button>
                    <div className="w-full h-px bg-border my-4"></div>
                    <button
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        try {
                          // Clear client state first (prevents flash of authenticated content)
                          await signOut();
                          // Call server API to ensure cookies are cleared
                          await fetch("/api/auth/signout", {
                            method: "POST",
                            credentials: "include",
                          }).catch(() => {});
                          // Force full page reload to clear any cached state
                          window.location.href = "/";
                        } catch {
                          window.location.href = "/";
                        }
                      }}
                      className="flex items-center w-full px-4 py-3 text-base font-semibold bg-servio-purple text-white hover:bg-white hover:text-servio-purple rounded-xl transition-all duration-200 min-h-[48px] justify-start border-2 border-servio-purple"
                    >
                      <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-white" />
                      <span className="text-white">Sign Out</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href={
                        venueId || primaryVenueId ? `/dashboard/${venueId || primaryVenueId}` : "/"
                      }
                      className="flex items-center px-4 py-3 text-base font-medium !text-gray-900 dark:!text-gray-100 hover:!text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="mr-3 h-5 w-5 flex-shrink-0 !text-gray-900 dark:!text-gray-100" />
                      <span className="!text-gray-900 dark:!text-gray-100 font-semibold">
                        Dashboard
                      </span>
                    </Link>
                    {(!userRole || userRole === "owner" || userRole === "manager") && (
                      <Link
                        href={
                          venueId || primaryVenueId
                            ? `/dashboard/${venueId || primaryVenueId}/settings`
                            : "/"
                        }
                        className="flex items-center px-4 py-3 text-base font-medium !text-gray-900 dark:!text-gray-100 hover:!text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px]"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Settings className="mr-3 h-5 w-5 flex-shrink-0 !text-gray-900 dark:!text-gray-100" />
                        <span className="!text-gray-900 dark:!text-gray-100 font-semibold">
                          Settings
                        </span>
                      </Link>
                    )}
                    {/* Dark mode button hidden on home page */}
                    <div className="w-full h-px bg-border my-4"></div>
                    <button
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        try {
                          // Clear client state first (prevents flash of authenticated content)
                          await signOut();
                          // Call server API to ensure cookies are cleared
                          await fetch("/api/auth/signout", {
                            method: "POST",
                            credentials: "include",
                          }).catch(() => {});
                          // Force full page reload to clear any cached state
                          window.location.href = "/";
                        } catch {
                          window.location.href = "/";
                        }
                      }}
                      className="flex items-center w-full px-4 py-3 text-base font-semibold bg-servio-purple !text-white hover:bg-white hover:!text-servio-purple rounded-xl transition-all duration-200 min-h-[48px] justify-start border-2 border-servio-purple"
                    >
                      <LogOut className="mr-3 h-5 w-5 flex-shrink-0 !text-white" />
                      <span className="!text-white font-semibold">Sign Out</span>
                    </button>
                  </>
                )}
              </>
            ) : (
              // Not signed in mobile navigation
              <>
                <Link
                  href="/"
                  className="px-4 py-3 text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="#features"
                  className="px-4 py-3 text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className="px-4 py-3 text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-servio-purple hover:bg-servio-purple/5 rounded-xl transition-all duration-200 min-h-[48px] flex items-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <div className="w-full h-px bg-border dark:bg-border my-4"></div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push("/sign-in");
                  }}
                  className="w-full px-4 py-3 text-base font-semibold text-white bg-servio-purple hover:bg-white hover:text-servio-purple rounded-xl transition-all duration-200 min-h-[48px] flex items-center justify-center border-2 border-servio-purple"
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
