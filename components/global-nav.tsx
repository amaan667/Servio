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
import { useRouter } from "next/navigation";

export default function GlobalNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(null);
  // Use our central auth context instead of local state
  const { session, loading } = useAuth();
  const router = useRouter();

  // Fetch primary venue when user is signed in
  useEffect(() => {
    const fetchPrimaryVenue = async () => {
      if (session?.user) {
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
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const settingsHref = primaryVenueId ? `/dashboard/${primaryVenueId}/settings` : '/settings';

  return (
    <nav className="bg-white/90 backdrop-blur-sm shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-32 sm:h-36">
          {/* Logo - Left aligned on desktop, centered on mobile */}
          <div className="flex-shrink-0 md:flex-shrink-0 md:order-1 order-2 md:justify-start justify-center flex-1 md:flex-none">
            <Link href={session ? "/dashboard" : "/"} className="flex items-center group">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={800}
                height={250}
                className="h-48 sm:h-56 w-auto transition-all duration-300 group-hover:scale-105"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation - Right side */}
          <div className="hidden md:block md:order-2">
            <div className="ml-4 lg:ml-6 flex items-center space-x-3 lg:space-x-4">
              {session ? (
                // Signed in navigation
                <>
                  <Link
                    href="/"
                    className="text-gray-600 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Home
                  </Link>
                  <Link
                    href="/dashboard"
                    className="text-gray-600 hover:text-gray-900 px-2 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Dashboard
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
                        <Link href="/" className="flex items-center gap-2">
                          <Home className="h-4 w-4" />
                          Home
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex items-center gap-2">
                          <span>Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      {primaryVenueId && (
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
              ) : (
                // Not signed in navigation
                <>
                  <Link
                    href="/"
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
          </div>

          {/* Mobile menu button - Right side */}
          <div className="md:hidden md:order-3 order-1">
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
            {session ? (
              // Signed in mobile navigation
              <>
                <Link
                  href="/"
                  className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                {primaryVenueId && (
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
                  href="/"
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
