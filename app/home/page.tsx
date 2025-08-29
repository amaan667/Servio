"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

    async function checkSession() {
      try {
        const { data } = await createClient().auth.getSession();
        
        if (!data.session) {
          // If no session, redirect to sign-in
          router.push("/sign-in");
        } else {
          // User is authenticated, redirect to dashboard
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setLoading(false);
      }
    }
    
    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {loading && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Redirecting...</p>
        </div>
      )}
    </div>
  );
}
