"use client";

import { ReactNode } from "react";
import { useAuth } from "./auth/AuthProvider";
import { redirect } from "next/navigation";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!session) return null;

  return <>{children}</>;
}
