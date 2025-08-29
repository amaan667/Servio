'use client';

import { useEffect } from 'react';
import { useAuth } from '@/app/authenticated-client-provider';
import { createClient, getBrowserInfo } from '@/lib/sb-client';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { session, loading } = useAuth();

  useEffect(() => {
    // Log device and browser information for debugging
    console.log('[AUTH DEBUG] AuthWrapper: Device info', {
      browserInfo: getBrowserInfo(),
      timestamp: new Date().toISOString()
    });
  }, []);

  // Handle beforeunload event to clean up OAuth state
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear OAuth progress flags when page is about to unload
      sessionStorage.removeItem("sb_oauth_in_progress");
      sessionStorage.removeItem("sb_oauth_start_time");
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return <>{children}</>;
}
