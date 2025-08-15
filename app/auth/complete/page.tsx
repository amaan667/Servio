"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/sb-client';

function AuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    const completeAuth = async () => {
      try {
        const code = searchParams.get('code');
        
        if (!code) {
          setStatus('No authentication code found');
          setTimeout(() => router.push('/sign-in'), 2000);
          return;
        }

        setStatus('Completing OAuth flow...');
        
        // Try to complete the OAuth flow on the client side
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error('Client-side OAuth completion failed:', error);
          setStatus('Authentication failed. Redirecting...');
          setTimeout(() => router.push('/sign-in?error=client_auth_failed'), 2000);
          return;
        }

        if (data.session) {
          setStatus('Authentication successful! Redirecting to dashboard...');
          
          // Create venue for new users
          try {
            const venueId = `venue-${data.session.user.id.slice(0, 8)}`;
            
            await supabase
              .from("venues")
              .upsert({
                venue_id: venueId,
                name: data.session.user.user_metadata?.full_name || data.session.user.email?.split('@')[0] || 'My Venue',
                business_type: 'Restaurant',
                owner_id: data.session.user.id,
                email: data.session.user.email,
              });
          } catch (venueError) {
            console.error('Venue creation error (non-critical):', venueError);
          }
          
          router.push('/dashboard');
        } else {
          setStatus('Authentication failed. Redirecting...');
          setTimeout(() => router.push('/sign-in'), 2000);
        }
      } catch (error) {
        console.error('Auth completion error:', error);
        setStatus('Authentication error. Redirecting...');
        setTimeout(() => router.push('/sign-in'), 2000);
      }
    };

    completeAuth();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    }>
      <AuthCompleteContent />
    </Suspense>
  );
}
