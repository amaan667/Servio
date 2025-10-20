import React from 'react';
import { createServerSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  // Log auth errors but don't redirect
  if (userError) {
    console.error('[DASHBOARD] Auth error:', userError.message);
  }
  
  // Only redirect if there's genuinely no user (not an error)
  if (!user && !userError) {
    redirect('/sign-in');
  }
  
  // If no user after checks, show message
  if (!user) {
    return <div>Please sign in to access the dashboard</div>;
  }

  const { data: venues, error: venueError } = await supabase
    .from('venues')
    .select('venue_id, venue_name, created_at')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: true });

  if (venueError) {
    redirect('/complete-profile');
  }

  if (!venues || venues.length === 0) {
    redirect('/complete-profile');
  }

  const mainVenue = venues[0];
  redirect(`/dashboard/${mainVenue.venue_id}`);
}