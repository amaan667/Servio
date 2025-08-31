export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseAuthCookies } from '@/lib/auth/utils';
import { redirect } from 'next/navigation';

export default async function VenueSettings({ params }: { params: { venueId: string } }) {
  const cookieStore = await cookies();
  const names = cookieStore.getAll().map(c => c.name);
  
  if (!hasSupabaseAuthCookies(names)) {
    console.log('[AUTH DEBUG] No auth cookies found, redirecting to sign-in');
    redirect('/sign-in');
  }

  const supabase = await createServerSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError) {
    console.error('[AUTH DEBUG] Error getting user:', userError);
    redirect('/sign-in');
  }
  
  if (!user) {
    console.log('[AUTH DEBUG] No user found, redirecting to sign-in');
    redirect('/sign-in');
  }

  const { data: venue, error } = await supabase
    .from('venues')
    .select('venue_id, name, slug, owner_id')
    .eq('venue_id', params.venueId)
    .single();

  if (error) {
    console.error('[AUTH DEBUG] Failed to load venue:', error);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">Error Loading Venue</h2>
            <p className="text-sm text-gray-600 mb-4">Unable to load venue settings. Please try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings for {venue.name}</h1>
          <p className="text-gray-600">Venue settings page is working correctly.</p>
        </div>
      </div>
    </div>
  );
}
