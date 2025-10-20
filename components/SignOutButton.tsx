"use client";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthProvider";

export function SignOutButton() {
  const sb = createClient();
  const router = useRouter();
  const { signOut } = useAuth();
  
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
          } else {
          }
        } catch (error) {
        }
        
        // Clear client-side storage and redirect
        try {
          const { clearAuthStorage } = await import('@/lib/supabase');
          clearAuthStorage();
        } catch (error) {
        }
        
        // Use the auth provider's signOut method
        await signOut();
        
        // Force redirect to home page
        router.replace("/");
        
      }}
      className="rounded-md border px-3 py-2"
    >
      Sign out
    </button>
  );
}
