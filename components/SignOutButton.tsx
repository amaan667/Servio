"use client";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const sb = createClient();
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        try {
          // Use server-side sign out to avoid cookie modification errors
          const response = await fetch('/api/auth/signout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            console.log('[AUTH DEBUG] Server-side sign out failed');
          } else {
            console.log('[AUTH DEBUG] Server-side sign out successful');
          }
        } catch (error) {
          console.log('[AUTH DEBUG] Sign out error:', error);
        }
        
        // Clear client-side storage and redirect
        try {
          const { clearAuthStorage } = await import('@/lib/sb-client');
          clearAuthStorage();
        } catch (error) {
          console.log('[AUTH DEBUG] Error clearing client storage:', error);
        }
        
        router.replace("/sign-in");
      }}
      className="rounded-md border px-3 py-2"
    >
      Sign out
    </button>
  );
}
