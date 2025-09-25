'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { getAuthRedirectUrl } from '@/lib/auth';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const router = useRouter();
  const [isSigningUp, setIsSigningUp] = useState(false);
  
  const signUpWithGoogle = async () => {
    if (isSigningUp) {
      return;
    }
    
    try {
      setIsSigningUp(true);

      // Use stable redirect URL helper
      const redirectTo = getAuthRedirectUrl('/auth/callback');
      
      const { data, error } = await supabaseBrowser().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { 
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true',
          },
          // Enable PKCE for better security
          flowType: 'pkce',
        },
      });
      
      if (error) {
        console.error('OAuth sign up error:', error);
        alert(`Sign up failed: ${error.message}`);
        setIsSigningUp(false);
        return;
      }
      
      // The redirect should happen automatically, but if it doesn't, we'll handle it
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Sign up error:', error);
      alert('Sign up failed. Please try again.');
      setIsSigningUp(false);
    }
  };

  return <SignUpForm onGoogleSignIn={signUpWithGoogle} isSigningUp={isSigningUp} />;
}
