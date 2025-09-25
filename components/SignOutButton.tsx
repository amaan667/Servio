"use client";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthProvider";
import { logInfo } from "@/lib/logger";

export function SignOutButton() {
  const sb = createClient();
  const router = useRouter();
  const { signOut } = useAuth();
  
  return (
    <button
      onClick={async () => {
        try {
          logInfo('[AUTH DEBUG] SignOutButton clicked');
          
          // Use server-side sign out to avoid cookie modification errors
          const response = await fetch('/api/auth/signout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            logInfo('[AUTH DEBUG] Server-side sign out failed');
          } else {
            logInfo('[AUTH DEBUG] Server-side sign out successful');
          }
        } catch (error) {
          logInfo('[AUTH DEBUG] Sign out error:', error);
        }
        
        // Clear client-side storage and redirect
        try {
          const { clearAuthStorage } = await import('@/lib/sb-client');
          clearAuthStorage();
        } catch (error) {
          logInfo('[AUTH DEBUG] Error clearing client storage:', error);
        }
        
        // Use the auth provider's signOut method
        await signOut();
        
        // Force redirect to home page
        router.replace("/");
        
        logInfo('[AUTH DEBUG] SignOutButton completed');
      }}
      className="rounded-md border px-3 py-2"
    >
      Sign out
    </button>
  );
}
