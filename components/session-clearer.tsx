'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface SessionClearerProps {
  error?: string;
  onClear?: () => void;
}

export default function SessionClearer({ error, onClear }: SessionClearerProps) {
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const router = useRouter();

  const clearSession = async () => {
    try {
      setIsClearing(true);
      setClearError(null);
      
      console.log('[SESSION_CLEARER] Clearing session...');
      
      // Clear Supabase session
      if (supabase) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          console.error('[SESSION_CLEARER] Sign out error:', signOutError);
        }
      }
      
      // Clear any remaining auth data
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
      
      // Clear any other potential auth-related items
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('supabase')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log('[SESSION_CLEARER] Session cleared successfully');
      
      // Call the onClear callback if provided
      if (onClear) {
        onClear();
      } else {
        // Default behavior: redirect to sign-in
        router.replace('/sign-in');
      }
      
    } catch (err) {
      console.error('[SESSION_CLEARER] Error clearing session:', err);
      setClearError('Failed to clear session. Please try refreshing the page.');
    } finally {
      setIsClearing(false);
    }
  };

  // Auto-clear session if it's a refresh token error
  useEffect(() => {
    if (error && (error.includes('Invalid Refresh Token') || error.includes('Refresh Token Not Found'))) {
      console.log('[SESSION_CLEARER] Auto-clearing session due to refresh token error');
      clearSession();
    }
  }, [error]);

  if (clearError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Session Clear Error</AlertTitle>
        <AlertDescription>
          {clearError}
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-2"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Authentication Issue</AlertTitle>
      <AlertDescription>
        {error || 'There was a problem with your session.'}
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-2"
          onClick={clearSession}
          disabled={isClearing}
        >
          {isClearing ? (
            <>
              <RefreshCw className="h-3 w-3 animate-spin mr-1" />
              Clearing...
            </>
          ) : (
            'Clear Session & Sign In'
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
