"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/client";

// This component will check for authentication and redirect appropriately
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    async function checkAuth() {
      try {
        // SECURE: Use the secure authentication utility
        const { user, error } = await getAuthenticatedUser();
        
        if (error || !user) {
          // If no authenticated user, redirect to sign-in
          router.push("/sign-in");
        } else {
          // User is authenticated, redirect to dashboard
          router.push("/dashboard");
        }
      } catch (error) {
        // On error, redirect to sign-in
        router.push("/sign-in");
      }
    }
    
    checkAuth();
  }, [router]);

  return null;
}
