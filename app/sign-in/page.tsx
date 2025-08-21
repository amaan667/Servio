'use client';

import { Suspense } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';
import SignInForm from './signin-form';

function SignInPageContent() {
  const signInWithGoogle = async () => {
    const supabase = supabaseBrowser();
    const base = process.env.NEXT_PUBLIC_APP_URL!;
    console.log('[AUTH] Starting OAuth with redirect:', `${base}/auth/callback`);
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${base}/auth/callback`,
        queryParams: { 
          prompt: 'select_account',
          access_type: 'offline'
        },
      },
    });
    if (error) console.error('[AUTH] Sign-in error:', error);
  };

  return <SignInForm onGoogleSignIn={signInWithGoogle} />;
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SignInPageContent />
    </Suspense>
  );
}
