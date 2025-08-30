'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';

export default function DashboardDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  const collectDebugInfo = async () => {
    console.log('[AUTH DEBUG] === COLLECTING DEBUG INFO ===');
    
    try {
      // Get current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      // Check localStorage and sessionStorage
      const localStorageKeys = Object.keys(localStorage).filter(k => 
        k.includes('auth') || k.includes('sb-') || k.includes('pkce')
      );
      const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
        k.includes('auth') || k.includes('sb-') || k.includes('pkce')
      );
      
      // Get browser info
      const browserInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        currentUrl: window.location.href,
        currentOrigin: window.location.origin,
      };
      
      // Get environment info
      const envInfo = {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      };
      
      const info = {
        timestamp: new Date().toISOString(),
        session: {
          hasSession: !!sessionData.session,
          userId: sessionData.session?.user?.id,
          userEmail: sessionData.session?.user?.email,
          expiresAt: sessionData.session?.expires_at,
          hasError: !!sessionError,
          errorMessage: sessionError?.message,
        },
        user: {
          hasUser: !!userData.user,
          userId: userData.user?.id,
          userEmail: userData.user?.email,
          hasError: !!userError,
          errorMessage: userError?.message,
        },
        storage: {
          localStorage: {
            totalKeys: Object.keys(localStorage).length,
            authKeys: localStorageKeys,
            authValues: localStorageKeys.reduce((acc, key) => {
              try {
                acc[key] = localStorage.getItem(key)?.substring(0, 50) + '...';
              } catch (e) {
                acc[key] = 'Error reading value';
              }
              return acc;
            }, {} as Record<string, string>),
          },
          sessionStorage: {
            totalKeys: Object.keys(sessionStorage).length,
            authKeys: sessionStorageKeys,
            authValues: sessionStorageKeys.reduce((acc, key) => {
              try {
                acc[key] = sessionStorage.getItem(key)?.substring(0, 50) + '...';
              } catch (e) {
                acc[key] = 'Error reading value';
              }
              return acc;
            }, {} as Record<string, string>),
          },
        },
        browser: browserInfo,
        environment: envInfo,
      };
      
      console.log('[AUTH DEBUG] Debug info collected:', info);
      setDebugInfo(info);
      
    } catch (error) {
      console.error('[AUTH DEBUG] Error collecting debug info:', error);
      setDebugInfo({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const clearAuthState = async () => {
    console.log('[AUTH DEBUG] === CLEARING AUTH STATE ===');
    
    try {
      // Clear localStorage
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("sb-") || k.includes("pkce") || k.includes("auth")) {
          console.log('[AUTH DEBUG] Clearing localStorage key:', k);
          localStorage.removeItem(k);
        }
      });
      
      // Clear sessionStorage
      Object.keys(sessionStorage).forEach((k) => {
        if (k.includes("pkce") || k.includes("auth")) {
          console.log('[AUTH DEBUG] Clearing sessionStorage key:', k);
          sessionStorage.removeItem(k);
        }
      });
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.log('[AUTH DEBUG] Sign out error:', error);
      } else {
        console.log('[AUTH DEBUG] Sign out successful');
      }
      
      // Reload page
      window.location.reload();
      
    } catch (error) {
      console.error('[AUTH DEBUG] Error clearing auth state:', error);
    }
  };

  useEffect(() => {
    if (isVisible) {
      collectDebugInfo();
    }
  }, [isVisible]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={() => setIsVisible(!isVisible)}
        variant="outline"
        size="sm"
        className="mb-2"
      >
        {isVisible ? 'Hide' : 'Show'} Debug Panel
      </Button>
      
      {isVisible && (
        <Card className="w-96 max-h-96 overflow-y-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Auth Debug Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex gap-2 mb-2">
              <Button size="sm" onClick={collectDebugInfo} variant="outline">
                Refresh
              </Button>
              <Button size="sm" onClick={clearAuthState} variant="destructive">
                Clear Auth
              </Button>
            </div>
            
            {debugInfo ? (
              <div className="space-y-3">
                {/* Session Status */}
                <div>
                  <h4 className="font-semibold mb-1">Session Status</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Has Session:</span>
                      <Badge variant={debugInfo.session.hasSession ? "default" : "secondary"}>
                        {debugInfo.session.hasSession ? "Yes" : "No"}
                      </Badge>
                    </div>
                    {debugInfo.session.hasSession && (
                      <>
                        <div>User ID: {debugInfo.session.userId}</div>
                        <div>Email: {debugInfo.session.userEmail}</div>
                        <div>Expires: {new Date(debugInfo.session.expiresAt * 1000).toLocaleString()}</div>
                      </>
                    )}
                    {debugInfo.session.hasError && (
                      <div className="text-red-600">Error: {debugInfo.session.errorMessage}</div>
                    )}
                  </div>
                </div>
                
                {/* Storage Info */}
                <div>
                  <h4 className="font-semibold mb-1">Storage</h4>
                  <div className="space-y-1">
                    <div>localStorage: {debugInfo.storage.localStorage.totalKeys} keys</div>
                    <div>sessionStorage: {debugInfo.storage.sessionStorage.totalKeys} keys</div>
                    {debugInfo.storage.localStorage.authKeys.length > 0 && (
                      <div className="text-blue-600">
                        Auth keys: {debugInfo.storage.localStorage.authKeys.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Environment */}
                <div>
                  <h4 className="font-semibold mb-1">Environment</h4>
                  <div className="space-y-1">
                    <div>NODE_ENV: {debugInfo.environment.NODE_ENV}</div>
                    <div>Supabase URL: {debugInfo.environment.NEXT_PUBLIC_SUPABASE_URL}</div>
                    <div>Supabase Key: {debugInfo.environment.NEXT_PUBLIC_SUPABASE_ANON_KEY}</div>
                  </div>
                </div>
                
                {/* Browser Info */}
                <div>
                  <h4 className="font-semibold mb-1">Browser</h4>
                  <div className="space-y-1">
                    <div>Platform: {debugInfo.browser.platform}</div>
                    <div>Online: {debugInfo.browser.onLine ? "Yes" : "No"}</div>
                    <div>Cookies: {debugInfo.browser.cookieEnabled ? "Enabled" : "Disabled"}</div>
                  </div>
                </div>
                
                <div className="text-gray-500 text-xs">
                  Last updated: {new Date(debugInfo.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div>Loading debug info...</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
