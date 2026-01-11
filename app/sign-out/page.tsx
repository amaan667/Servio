"use client";

import { useAuth } from "@/app/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignOutPage() {
  const { signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const performSignOut = async () => {
      try {
        // Call server-side sign out
        const response = await fetch("/api/auth/signout", {

          headers: { "Content-Type": "application/json" },

        if (!response.ok) {
          // Empty block
        } else {
          // Intentionally empty
        }

        // Clear client storage
        try {
          const { clearAuthStorage } = await import("@/lib/supabase");
          clearAuthStorage();
        } catch (_error) {
          // Error silently handled
        }

        // Use auth provider's signOut method
        await signOut();

        // Redirect to home page
        router.replace("/");
      } catch (_error) {
        router.replace("/");
      }
    };

    performSignOut();
  }, [signOut, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Signing out...</h2>
        <p className="text-gray-900">Please wait while we sign you out.</p>
      </div>
    </div>
  );
}
