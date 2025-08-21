'use client';

import { useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

export default function SessionClearer() {
  useEffect(() => {
    const supabase = supabaseBrowser();
    
    // Check if we're on a page that should clear the session
    const shouldClearSession = window.location.pathname === '/sign-in' && 
      window.location.search.includes('signedOut=true');
    
    if (shouldClearSession) {
      console.log('[SESSION CLEARER] Clearing session due to signedOut parameter');
      supabase.auth.signOut().then(() => {
        console.log('[SESSION CLEARER] Session cleared successfully');
      }).catch((error) => {
        console.error('[SESSION CLEARER] Error clearing session:', error);
      });
    }
  }, []);

  return null; // This component doesn't render anything
}
