"use client";

import { useAuth } from "@/app/auth/AuthProvider";
import { useEffect, useState } from "react";

export default function SignOutPage() {
  const { signOut } = useAuth();
  const [status, setStatus] = useState("Signing out...");

  useEffect(() => {
    const performSignOut = async () => {
      try {
        // STEP 1: Clear client-side auth state first (prevents UI flicker)
        setStatus("Clearing local session...");
        await signOut();

        // STEP 2: Clear all client storage comprehensively
        setStatus("Clearing stored data...");
        try {
          const { clearAuthStorage } = await import("@/lib/supabase");
          clearAuthStorage();
        } catch {
          // Fallback: manually clear critical storage
          if (typeof window !== "undefined") {
            localStorage.removeItem("sb-auth-session");
            // Clear all auth-related keys
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (
                key &&
                (key.startsWith("sb-") ||
                  key.startsWith("user_role_") ||
                  key.startsWith("venue_id_") ||
                  key.startsWith("dashboard_"))
              ) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach((key) => localStorage.removeItem(key));
          }
        }

        // STEP 3: Call server-side sign out to clear cookies
        setStatus("Clearing server session...");
        await fetch("/api/auth/signout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }).catch(() => {
          // Server call failed, but local state is already cleared
        });

        // STEP 4: Force a full page navigation (not client-side routing)
        // This ensures all React state is reset and server renders fresh content
        setStatus("Redirecting...");

        // Use a slight delay to ensure all async operations complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Force full page reload to clear any cached React state
        window.location.href = "/";
      } catch {
        // Even on error, redirect to home
        window.location.href = "/";
      }
    };

    performSignOut();
  }, [signOut]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Signing out...</h2>
        <p className="text-gray-900">{status}</p>
      </div>
    </div>
  );
}
