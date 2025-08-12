'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function CallbackClient() {
  const [msg, setMsg] = useState('Booting…');
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (!code) { 
        setMsg('No code → /sign-in'); 
        router.replace('/sign-in?error=no_code'); 
        return; 
      }

      setMsg('Exchanging code…');
      // add a timeout so we see hangs
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
      try {
        const { data: { user }, error } = await Promise.race([
          supabase.auth.exchangeCodeForSession(code),
          timeout,
        ]);
        
        if (error) {
          setMsg(`Exchange failed: ${error.message}`);
          router.replace('/sign-in?error=exchange_failed');
          return;
        }

        if (!user) {
          setMsg('No user returned → /sign-in');
          router.replace('/sign-in?error=no_user');
          return;
        }

        setMsg('Checking profile…');
        
        // Check if user has a venue (profile completed)
        const { data: venues, error: venueError } = await supabase
          .from('venues')
          .select('venue_id')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (venueError) {
          console.error('Error checking venue:', venueError);
          // If error checking venues, redirect to complete profile to be safe
          setMsg('Profile check failed → /complete-profile');
          setTimeout(() => router.replace('/complete-profile'), 50);
          return;
        }

        if (venues?.venue_id) {
          // Existing user with profile → dashboard
          setMsg('Existing user → /dashboard');
          setTimeout(() => router.replace('/dashboard'), 50);
        } else {
          // New user or user without profile → complete profile
          setMsg('New user → /complete-profile');
          setTimeout(() => router.replace('/complete-profile'), 50);
        }
      } catch (e: any) {
        setMsg(`Exchange failed: ${e?.message || e}`);
        router.replace('/sign-in?error=exchange_failed');
      }
    };
    run();
  }, [router, supabase]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Finishing sign in…</h1>
      <p>{msg}</p>
    </div>
  );
}

