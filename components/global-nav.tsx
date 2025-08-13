"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/sb-client";
import { Menu, X } from "lucide-react";

export default function GlobalNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authState, setAuthState] = useState<{
    authenticated: boolean;
    user: any;
    loading: boolean;
  }>({
    authenticated: false,
    user: null,
    loading: true
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth-check');
        const data = await response.json();
        
        setAuthState({
          authenticated: data.authenticated,
          user: data.user,
          loading: false
        });
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState({
          authenticated: false,
          user: null,
          loading: false
        });
      }
    };

    checkAuth();

    // Listen for auth state changes (for sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setAuthState({
          authenticated: false,
          user: null,
          loading: false
        });
      } else if (event === 'SIGNED_IN') {
        // Re-check auth state after sign in
        checkAuth();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/sign-out';
    }
  };

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

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-6 lg:ml-10 flex items-center space-x-4 lg:space-x-6">
              {!authState.authenticated && (
                <>
                  <Link
                    href="/"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-base font-medium"
                  >
                    Home
                  </Link>
                  <Link
                    href="#features"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-base font-medium"
                  >
                    Features
                  </Link>
                  <Link
                    href="#pricing"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-base font-medium"
                  >
                    Pricing
                  </Link>
                </>
              )}
              {authState.loading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
              ) : authState.authenticated ? (
                <>
                  <Link
                    href="/"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-base font-medium"
                  >
                    Home
                  </Link>
                  <Link
                    href="/settings"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-base font-medium"
                  >
                    Settings
                  </Link>
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    size="sm"
                    className="ml-2 text-base"
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-base font-medium">Sign In</Link>
                  <Link href="/sign-up">
                    <Button size="sm" className="ml-2 text-base">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
                {!authState.authenticated && (
                  <>
                    <Link href="/" className="text-gray-700 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium" onClick={() => setMobileMenuOpen(false)}>Home</Link>
                    <Link href="#features" className="text-gray-700 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium" onClick={() => setMobileMenuOpen(false)}>Features</Link>
                    <Link href="#pricing" className="text-gray-700 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
                  </>
                )}
            {authState.loading ? (
              <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
            ) : authState.authenticated ? (
              <>
                <Link
                  href="/dashboard"
                      className="text-gray-700 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                    <Link href="/settings" className="text-gray-700 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium" onClick={() => setMobileMenuOpen(false)}>Settings</Link>
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                    <Link href="/sign-in" className="text-gray-700 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                      <Button size="sm" className="w-full mt-2 text-base">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
} 
