import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

export function GoogleSignInButton({ 
  onSuccess, 
  onError, 
  disabled = false,
  className = "w-full"
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    // Prevent multiple simultaneous calls
    if (isLoading || disabled) return;
    
    setIsLoading(true);
    
    try {
      console.log('[AUTH DEBUG] ===== Google OAuth Sign In Started =====');
      
      // Clear only specific auth-related localStorage items
      const keysToRemove = [
        'supabase.auth.token',
        'sb-pkce-code-verifier',
        'sb-auth-token',
        'sb-access-token',
        'sb-refresh-token'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });

      // Also clear any Supabase-related keys
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sb-') || k.includes('pkce')) {
          localStorage.removeItem(k);
        }
      });

      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('sb-') || k.includes('pkce')) {
          sessionStorage.removeItem(k);
        }
      });

      console.log('[AUTH DEBUG] Auth state cleared');

      const { data, error } = await supabase().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        console.error('[AUTH DEBUG] OAuth initiation failed:', error);
        throw error;
      }

      console.log('[AUTH DEBUG] OAuth initiated successfully');
      onSuccess?.();

    } catch (error: any) {
      console.error('Google sign-in failed:', error);
      onError?.(error.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      className={`${className} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2`}
      onClick={handleGoogleSignIn}
      disabled={isLoading || disabled}
    >
      <svg className="w-5 h-5" viewBox="0 0 48 48">
        <g>
          <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.22l6.85-6.85C35.64 2.09 30.18 0 24 0 14.82 0 6.44 5.48 2.69 13.44l7.98 6.2C12.13 13.09 17.62 9.5 24 9.5z"/>
          <path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.93 37.36 46.1 31.45 46.1 24.55z"/>
          <path fill="#FBBC05" d="M10.67 28.09c-1.09-3.22-1.09-6.7 0-9.92l-7.98-6.2C.64 16.36 0 20.09 0 24s.64 7.64 2.69 11.03l7.98-6.2z"/>
          <path fill="#EA4335" d="M24 48c6.18 0 11.36-2.05 15.14-5.59l-7.19-5.6c-2.01 1.35-4.59 2.15-7.95 2.15-6.38 0-11.87-3.59-14.33-8.75l-7.98 6.2C6.44 42.52 14.82 48 24 48z"/>
          <path fill="none" d="M0 0h48v48H0z"/>
        </g>
      </svg>
      {isLoading ? 'Signing in...' : 'Continue with Google'}
    </Button>
  );
}