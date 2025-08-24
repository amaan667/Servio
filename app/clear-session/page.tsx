'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export default function ClearSessionPage() {
  const [isClearing, setIsClearing] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const clearAllAuthData = async () => {
    try {
      setIsClearing(true);
      setError(null);
      
      console.log('[CLEAR_SESSION] Starting comprehensive session clear...');
      
      // 1. Sign out from Supabase
      if (supabase) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error('[CLEAR_SESSION] Supabase sign out error:', signOutError);
        }
      }
      
      // 2. Clear localStorage
      const localStorageKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('auth') || key.includes('session'))) {
          localStorageKeys.push(key);
          localStorage.removeItem(key);
        }
      }
      console.log('[CLEAR_SESSION] Cleared localStorage keys:', localStorageKeys);
      
      // 3. Clear sessionStorage
      const sessionStorageKeys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('auth') || key.includes('session'))) {
          sessionStorageKeys.push(key);
          sessionStorage.removeItem(key);
        }
      }
      console.log('[CLEAR_SESSION] Cleared sessionStorage keys:', sessionStorageKeys);
      
      // 4. Clear cookies (if possible)
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
      
      console.log('[CLEAR_SESSION] Session cleared successfully');
      setIsCleared(true);
      
      // Redirect to sign-in after a short delay
      setTimeout(() => {
        router.replace('/sign-in');
      }, 2000);
      
    } catch (err) {
      console.error('[CLEAR_SESSION] Error clearing session:', err);
      setError('Failed to clear session. Please try refreshing the page and clearing your browser data manually.');
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    // Auto-clear on page load
    clearAllAuthData();
  }, []);

  if (isCleared) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Session Cleared Successfully</CardTitle>
            <CardDescription>
              Your authentication session has been cleared. You will be redirected to the sign-in page shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Redirecting...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            Clear Authentication Session
          </CardTitle>
          <CardDescription>
            This will clear all authentication data and sign you out. Use this if you're experiencing login issues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              This process will:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 ml-4">
              <li>• Sign you out of your current session</li>
              <li>• Clear all authentication tokens</li>
              <li>• Remove stored session data</li>
              <li>• Redirect you to the sign-in page</li>
            </ul>
          </div>
          
          <Button 
            onClick={clearAllAuthData}
            disabled={isClearing}
            className="w-full"
          >
            {isClearing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Clearing Session...
              </>
            ) : (
              'Clear Session & Sign Out'
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => router.back()}
            className="w-full"
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
