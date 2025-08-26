"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/sb-client";

export default function SessionStateFix() {
  const [isFixing, setIsFixing] = useState(true);

  useEffect(() => {
    const fixSessionState = async () => {
      console.log('[SESSION FIX] Starting session state cleanup...');
      
      try {
        // 1. Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        console.log('[SESSION FIX] Current session state:', {
          hasSession: !!session,
          userId: session?.user?.id,
          error: sessionError?.message
        });

        // 2. If there's a session but it's invalid, clear it
        if (session && sessionError) {
          console.log('[SESSION FIX] Invalid session detected, clearing...');
          await supabase.auth.signOut();
          return;
        }

        // 3. Check if session is expired
        if (session && session.expires_at) {
          const now = Math.floor(Date.now() / 1000);
          if (session.expires_at < now) {
            console.log('[SESSION FIX] Expired session detected, clearing...');
            await supabase.auth.signOut();
            return;
          }
        }

        // 4. Clear any stale localStorage items
        if (typeof window !== 'undefined') {
          const staleKeys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
              // Keep only valid session data
              if (!session && key.includes('session')) {
                staleKeys.push(key);
              }
            }
          }
          
          staleKeys.forEach(key => {
            console.log('[SESSION FIX] Removing stale key:', key);
            localStorage.removeItem(key);
          });
        }

        console.log('[SESSION FIX] Session state cleanup completed');
      } catch (error) {
        console.error('[SESSION FIX] Error during session cleanup:', error);
      } finally {
        setIsFixing(false);
      }
    };

    fixSessionState();
  }, []);

  // This component doesn't render anything visible
  return null;
}