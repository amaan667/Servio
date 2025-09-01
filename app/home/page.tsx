"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/client";

// This component will check for authentication and redirect appropriately
export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    async function checkAuth() {
      try {
        // SECURE: Use the secure authentication utility
        const { user, error } = await getAuthenticatedUser();
        
        if (error || !user) {
          console.log('[HOME PAGE] No authenticated user, redirecting to sign-in');
          // If no authenticated user, redirect to sign-in
          router.push("/sign-in");
        } else {
          console.log('[HOME PAGE] User authenticated, redirecting to dashboard:', {
            userId: user.id,
            email: user.email
          });
          // User is authenticated, redirect to dashboard
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("[HOME PAGE] Error checking authentication:", error);
        // On error, redirect to sign-in
        router.push("/sign-in");
      } finally {
        setLoading(false);
      }
    }
    
    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {loading && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Checking authentication...</p>
        </div>
      )}
    </div>
  );
}
