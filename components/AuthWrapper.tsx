"use client";

import { ReactNode } from "react";
import { useAuth } from "@/app/auth/AuthProvider";

interface AuthWrapperProps {

}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  // NO REDIRECTS - User requested ZERO sign-in redirects
  // Always render children, let individual components handle auth

  return <>{children}</>;
}
