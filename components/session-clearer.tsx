"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/sb-client";

export default function SessionClearer() {
  const searchParams = useSearchParams();
  const signedOut = searchParams?.get('signedOut');
  const error = searchParams?.get('error');

  useEffect(() => {
  // Clear on explicit signOut OR on auth errors to prevent token reuse
  // But don't clear during OAuth process to avoid breaking PKCE flow
  if (signedOut === 'true' || error === 'session_expired') {
      // Force clear any remaining client-side session
      const clearSession = async () => {
        try {
          console.log('[AUTH DEBUG] SessionClearer: Clearing session due to', { signedOut, error });
          
          // Sign out from Supabase client - use global scope to clear on all devices
          await supabase.auth.signOut({ scope: 'global' });
          
          // Clear localStorage
          if (typeof window !== 'undefined') {
            // Clear all Supabase-related items
            Object.keys(localStorage).forEach(key => {
              if (key.includes('supabase') || key.includes('sb-') || key.includes('auth')) {
                localStorage.removeItem(key);
                console.log('[AUTH DEBUG] SessionClearer: Removed localStorage item:', key);
              }
            });
            
            // Clear sessionStorage
            sessionStorage.clear();
            
            // Clear any URL parameters that might cause issues
            if (window.history.replaceState) {
              const cleanUrl = window.location.pathname;
              window.history.replaceState({}, document.title, cleanUrl);
            }
          }
          
          console.log('[AUTH DEBUG] SessionClearer: Cleared all session data');
        } catch (error) {
          console.error('[AUTH DEBUG] SessionClearer: Error clearing session', error);
        }
      };
      
      clearSession();
    }
  }, [signedOut, error]);

  return null; // This component doesn't render anything
}
