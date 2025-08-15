"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/sb-client";
import { Menu, X, User, Home, Settings, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/app/authenticated-client-provider";
import { useRouter, usePathname } from "next/navigation";

interface UniversalHeaderProps {
  showActions?: boolean;
  venueId?: string;
}

export default function UniversalHeader({ showActions = true, venueId }: UniversalHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Determine if we're on home page or dashboard page
  const isHomePage = pathname === '/' || pathname === '/home';
  const isDashboardPage = pathname?.startsWith('/dashboard') || pathname?.startsWith('/settings');

  // Fetch primary venue when user is signed in
  useEffect(() => {
    const fetchPrimaryVenue = async () => {
      try {
        if (session?.user) {
          const { data, error } = await supabase
            .from('venues')
            .select('venue_id')
            .eq('owner_id', session.user.id)
            .order('created_at', { ascending: true })
            .limit(1);

          if (!error && data?.length) {
            setPrimaryVenueId(data[0].venue_id);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching primary venue:', err);
        setLoading(false);
      }
    };

    if (!venueId) {
      fetchPrimaryVenue();
    } else {
      setPrimaryVenueId(venueId);
      setLoading(false);
    }
  }, [venueId, session]);

  const resolvedVenueId = venueId ?? primaryVenueId;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  // Navigation links
  const homeHref = '/';
  const dashboardHref = resolvedVenueId ? `/dashboard/${resolvedVenueId}` : '/dashboard';
  const settingsHref = resolvedVenueId ? `/dashboard/${resolvedVenueId}/settings` : '/settings';

  if (loading) {
    return (
      <nav className="bg-white/90 backdrop-blur-sm shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-32">
            <div className="flex items-center">
              <div className="w-[240px] h-[48px] bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white/90 backdrop-blur-sm shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-32">
          {/* Logo - Centered on mobile, left aligned on desktop */}
          <div className="flex items-center justify-center md:justify-start flex-1 md:flex-none order-2 md:order-1">
            <Link href={session ? dashboardHref : homeHref} className="flex items-center group">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={240}
                height={60}
                className="h-48 w-auto transition-all duration-300 group-hover:scale-105"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation - Right side */}
          <div className="hidden md:flex items-center space-x-4 order-3">
            {session ? (
              // Signed in navigation
              <>
                <Link
                  href={homeHref}
                  className="text-gray-600 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Home
                </Link>
                <Link
                  href={dashboardHref}
                  className="text-gray-600 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Dashboard
                </Link>
                {showActions && (
                  <>
                    <Link
                      href={settingsHref}
                      className="text-gray-600 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Settings
                    </Link>
                    {/* Modern dropdown menu for user actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        >
                          <User className="h-4 w-4" />
                          <span className="text-sm font-medium">Account</span>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link href={homeHref} className="flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            Home
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={dashboardHref} className="flex items-center gap-2">
                            <span>Dashboard</span>
                          </Link>
                        </DropdownMenuItem>
                        {showActions && (
                          <DropdownMenuItem asChild>
                            <Link href={settingsHref} className="flex items-center gap-2">
                              <Settings className="h-4 w-4" />
                              Settings
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={handleSignOut}
                          className="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </>
            ) : (
              // Not signed in navigation
              <>
                <Link
                  href={homeHref}
                  className="text-gray-600 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Home
                </Link>
                <Link
                  href="#features"
                  className="text-gray-600 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className="text-gray-600 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Pricing
                </Link>
                <Link
                  href="/sign-in"
                  className="bg-servio-purple text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-servio-purple/90 transition-colors"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Mobile Navigation - Right side */}
          <div className="md:hidden flex items-center order-3">
            {/* Show hamburger menu only on home page */}
            {isHomePage && (
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
            )}
            
            {/* Show profile dropdown only on dashboard page */}
            {isDashboardPage && session && showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="flex items-center gap-2 p-2"
                  >
                    <User className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href={homeHref} className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Home
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={dashboardHref} className="flex items-center gap-2">
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={settingsHref} className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu - Only show on home page */}
      {mobileMenuOpen && isHomePage && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t">
            {session ? (
              // Signed in mobile navigation
              <>
                <Link
                  href={homeHref}
                  className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href={dashboardHref}
                  className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                {showActions && (
                  <Link
                    href={settingsHref}
                    className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Settings
                  </Link>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left text-gray-600 hover:text-gray-900"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              // Not signed in mobile navigation
              <>
                <Link
                  href={homeHref}
                  className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="#features"
                  className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="#pricing"
                  className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link
                  href="/sign-in"
                  className="bg-servio-purple text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-servio-purple/90"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}