"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/sb-client";

export default function SessionClearer() {
  const searchParams = useSearchParams();
  const signedOut = searchParams?.get('signedOut');

  useEffect(() => {
    if (signedOut === 'true') {
      // Force clear any remaining client-side session
      const clearSession = async () => {
        try {
          // Sign out from Supabase client
          await supabase.auth.signOut();
          
          // Clear localStorage
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
            
            // Remove any Supabase-related items
            Object.keys(localStorage).forEach(key => {
              if (key.includes('supabase') || key.includes('sb-')) {
                localStorage.removeItem(key);
              }
            });
          }
          
          console.log('[AUTH DEBUG] SessionClearer: Cleared all session data');
        } catch (error) {
          console.error('[AUTH DEBUG] SessionClearer: Error clearing session', error);
        }
      };
      
      clearSession();
    }
  }, [signedOut]);

  return null; // This component doesn't render anything
}
