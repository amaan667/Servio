'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[AUTH DEBUG] ===== AUTHENTICATION CALLBACK STARTED =====');
      console.log('[AUTH DEBUG] URL:', window.location.href);

      try {
        // Check for error parameters first
        const errorParam = searchParams?.get('error');
        const errorDescription = searchParams?.get('error_description');

        if (errorParam) {
          console.error('[AUTH DEBUG] ❌ OAuth error:', errorParam, errorDescription);
          router.push('/sign-in');
          return;
        }

        // Check if we have a code parameter
        const code = searchParams?.get('code');
        if (!code) {
          console.error('[AUTH DEBUG] ❌ No code parameter found');
          router.push('/sign-in');
          return;
        }

        console.log('[AUTH DEBUG] ✅ Code found, exchanging for session...');

        // Create client and exchange code for session
        const supabase = createClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);

        if (error) {
          console.error('[AUTH DEBUG] ❌ Exchange error:', error);
          router.push('/sign-in');
          return;
        }

        if (!data || !data.session) {
          console.error('[AUTH DEBUG] ❌ No session received');
          router.push('/sign-in');
          return;
        }

        console.log('[AUTH DEBUG] ✅ Authentication successful!');
        console.log('[AUTH DEBUG] User ID:', data.session.user.id);

        // Get redirectTo from URL params or default to dashboard
        const redirectTo = searchParams?.get('redirectTo') || '/dashboard';

        // Normalize redirectTo to exact origin
        const origin = window.location.origin;
        const normalizedRedirect = redirectTo.startsWith('/')
          ? `${origin}${redirectTo}`
          : redirectTo.startsWith(origin)
          ? redirectTo
          : `${origin}/dashboard`;

        console.log('[AUTH DEBUG] Redirecting to:', normalizedRedirect);
        window.location.href = normalizedRedirect;

      } catch (err) {
        console.error('[AUTH DEBUG] ❌ Unexpected error:', err);
        router.push('/sign-in');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  // No UI - client-only callback with no spinners or loading states
  return null;
}

export default function AuthCallback() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackInner />
    </Suspense>
  );
}
