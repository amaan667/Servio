"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, X, Settings, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/app/authenticated-client-provider";

export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Client-safe dashboard navigation - let server handle auth checks
  const handleDashboardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push('/dashboard');
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await fetch('/api/auth/sign-out', { method: 'POST' });
      router.replace('/');
    } catch (e) {
      console.error('[NAV] Sign-out error:', e);
      // Still navigate home even if sign-out fails
      router.replace('/');
    } finally {
      setSigningOut(false);
      setMobileMenuOpen(false);
    }
  };

  // Check active routes for styling
  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  const linkClass = (path: string) => {
    const base = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
    return isActive(path)
      ? `${base} text-purple-600 underline underline-offset-4`
      : `${base} text-gray-600 hover:text-gray-900`;
  };

  return (
    <nav className="bg-white/90 backdrop-blur-sm shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-3 md:py-4">
          {/* Logo - Left aligned */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center group mr-6">
              <Image
                src="/assets/servio-logo-updated.png"
                alt="Servio"
                width={120}
                height={32}
                className="h-8 w-auto transition-all duration-300 group-hover:scale-105"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation - Right side */}
          <div className="hidden md:flex items-center gap-6 md:gap-8">
            {session ? (
              // Signed in - inline navigation (no dropdown on desktop)
              <>
                <Link href="/" className={linkClass('/')}>
                  Home
                </Link>
                <a 
                  href="/dashboard" 
                  onClick={handleDashboardClick}
                  className={linkClass('/dashboard')}
                >
                  Dashboard
                </a>
                <Link href="/settings" className={linkClass('/settings')}>
                  Settings
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  aria-label="Sign out"
                >
                  {signingOut ? 'Signing out...' : 'Sign Out'}
                </Button>
              </>
            ) : (
              // Not signed in
              <>
                <Link href="/" className={linkClass('/')}>
                  Home
                </Link>
                <Link href="/#features" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Features
                </Link>
                <Link href="/#pricing" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Pricing
                </Link>
                <Link
                  href="/sign-in"
                  className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Mobile Navigation - Hamburger/Account menu */}
          <div className="md:hidden flex items-center">
            {session ? (
              // Signed in - show Account dropdown on mobile
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <span className="text-sm font-medium">Account</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/" className="flex items-center gap-2">
                      Home
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a 
                      href="/dashboard" 
                      onClick={handleDashboardClick}
                      className="flex items-center gap-2"
                    >
                      Dashboard
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {signingOut ? 'Signing out...' : 'Sign Out'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              // Not signed in - show hamburger menu
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
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu - Only for non-authenticated users */}
      {mobileMenuOpen && !session && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t">
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/#features"
              className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              href="/#pricing"
              className="text-gray-600 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              href="/sign-in"
              className="bg-purple-600 text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-purple-700"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}