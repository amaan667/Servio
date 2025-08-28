'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/authenticated-client-provider';
import { createClient, isMobileDevice, getBrowserInfo } from '@/lib/sb-client';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { session, loading } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<any>(null);

  useEffect(() => {
    // Detect mobile device and browser info
    setIsMobile(isMobileDevice());
    setBrowserInfo(getBrowserInfo());

    // Log device and browser information for debugging
    console.log('[AUTH DEBUG] AuthWrapper: Device info', {
      isMobile: isMobileDevice(),
      browserInfo: getBrowserInfo(),
      timestamp: new Date().toISOString()
    });

    // Handle mobile-specific authentication issues
    if (isMobileDevice()) {
      console.log('[AUTH DEBUG] AuthWrapper: Mobile device detected, applying mobile-specific optimizations');
      
      // Check for OAuth progress on mobile
      const oauthProgress = sessionStorage.getItem("sb_oauth_in_progress");
      const oauthStartTime = sessionStorage.getItem("sb_oauth_start_time");
      
      if (oauthProgress && oauthStartTime) {
        const startTime = parseInt(oauthStartTime);
        const elapsed = Date.now() - startTime;
        
        // If OAuth has been in progress for more than 5 minutes, clear it
        if (elapsed > 5 * 60 * 1000) {
          console.log('[AUTH DEBUG] AuthWrapper: Clearing stale OAuth progress on mobile');
          sessionStorage.removeItem("sb_oauth_in_progress");
          sessionStorage.removeItem("sb_oauth_start_time");
        }
      }
    }
  }, []);

  // Handle session recovery on mobile devices
  useEffect(() => {
    if (isMobile && !loading && !session) {
      console.log('[AUTH DEBUG] AuthWrapper: Attempting session recovery on mobile');
      
      // Try to recover session from storage
      const recoverSession = async () => {
        try {
          const { data, error } = await createClient().auth.getSession();
          if (data.session && !error) {
            console.log('[AUTH DEBUG] AuthWrapper: Session recovered on mobile');
          } else {
            console.log('[AUTH DEBUG] AuthWrapper: No session to recover on mobile');
          }
        } catch (err) {
          console.log('[AUTH DEBUG] AuthWrapper: Error recovering session on mobile', err);
        }
      };
      
      recoverSession();
    }
  }, [isMobile, loading, session]);

  // Handle page visibility changes (important for mobile)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isMobile) {
        console.log('[AUTH DEBUG] AuthWrapper: Page became visible on mobile, checking session');
        
        // Check session when page becomes visible on mobile
        const checkSession = async () => {
          try {
            const { data, error } = await createClient().auth.getSession();
            console.log('[AUTH DEBUG] AuthWrapper: Session check on visibility change', {
              hasSession: !!data.session,
              error: error?.message
            });
          } catch (err) {
            console.log('[AUTH DEBUG] AuthWrapper: Error checking session on visibility change', err);
          }
        };
        
        checkSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isMobile]);

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
