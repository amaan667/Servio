"use client";

import { useAuth } from "@/app/auth/AuthProvider";

interface ProtectedRouteProps {

}

export function ProtectedRoute({
  children,
  redirectTo: _redirectTo = "/sign-in", // Kept for API compatibility but not used (no redirects per requirement)
  fallback = <div>Loading...</div>,
  requireAuth = true,
  unauthorizedComponent = (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
        <p className="text-muted-foreground">Please sign in to access this page.</p>
      </div>
    </div>
  ),
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // Show loading state while checking auth
  if (loading) {
    return <>{fallback}</>;
  }

  // If auth is required but user is not authenticated, show unauthorized state
  // NO REDIRECTS - per requirement: use conditional rendering instead
  if (requireAuth && !user) {
    return <>{unauthorizedComponent}</>;
  }

  // Render children if:
  // 1. Auth is not required, OR
  // 2. Auth is required and user is authenticated
  return <>{children}</>;
}
