"use client";

import { useAuth } from "@/app/auth/AuthProvider";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  redirectTo: _redirectTo = "/sign-in",
  fallback = <div>Loading...</div>,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // NO REDIRECTS - User requested ZERO sign-in redirects
  // Just render children regardless of auth state
  // Individual components will handle auth checks if needed

  if (loading) {
    return <>{fallback}</>;
  }

  // Always render children, even without user
  return <>{children}</>;
}
