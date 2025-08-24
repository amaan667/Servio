export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/debug';
import LiveOrdersClient from './LiveOrdersClient';
import PageHeader from '@/components/PageHeader';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';
import SessionClearer from '@/components/session-clearer';

// Simple diagnostic component
function DiagnosticInfo({ error, venueId }: { error?: string; venueId: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-medium text-red-800 mb-2">Diagnostic Information</h3>
      <div className="text-sm text-red-700 space-y-2">
        <p><strong>Venue ID:</strong> {venueId}</p>
        <p><strong>Environment Check:</strong></p>
        <ul className="ml-4 space-y-1">
          <li>SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing'}</li>
          <li>SUPABASE_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}</li>
          <li>SERVICE_KEY: {process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'}</li>
        </ul>
        <p><strong>Runtime:</strong> Node.js</p>
        <p><strong>Dynamic:</strong> force-dynamic</p>
        {error && <p><strong>Error:</strong> {error}</p>}
        <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
      </div>
    </div>
  );
}

export default async function LiveOrdersPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[LIVE-ORDERS] === PAGE START ===');
  console.log('[LIVE-ORDERS] Venue ID:', params.venueId);
  console.log('[LIVE-ORDERS] Environment check:', {
    url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
  
  // Basic environment check
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[LIVE-ORDERS] Missing required environment variables');
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader
            title="Live Orders"
            description="Monitor and manage real-time orders"
            venueId={params.venueId}
          />
          <DiagnosticInfo error="Missing environment variables" venueId={params.venueId} />
        </div>
      </div>
    );
  }

  try {
    console.log('[LIVE-ORDERS] Creating Supabase client...');
    const supabase = createServerSupabase();
    console.log('[LIVE-ORDERS] Supabase client created successfully');

    console.log('[LIVE-ORDERS] Getting user session...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('[LIVE-ORDERS] Auth error:', authError);
      
      // Check if it's a refresh token error
      const isRefreshTokenError = authError.message.includes('Invalid Refresh Token') || 
                                 authError.message.includes('Refresh Token Not Found');
      
      return (
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PageHeader
              title="Live Orders"
              description="Monitor and manage real-time orders"
              venueId={params.venueId}
            />
            {isRefreshTokenError ? (
              <SessionClearer error={authError.message} />
            ) : (
              <DiagnosticInfo error={`Authentication error: ${authError.message}`} venueId={params.venueId} />
            )}
          </div>
        </div>
      );
    }
    
    console.log('[LIVE-ORDERS] User check:', { hasUser: !!user, userId: user?.id });
    if (!user) {
      console.log('[LIVE-ORDERS] No user found, redirecting to sign-in');
      redirect('/sign-in');
    }

    console.log('[LIVE-ORDERS] Checking venue ownership...');
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('venue_id', params.venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (venueError) {
      console.error('[LIVE-ORDERS] Venue query error:', venueError);
      return (
        <div className="min-h-screen bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PageHeader
              title="Live Orders"
              description="Monitor and manage real-time orders"
              venueId={params.venueId}
            />
            <DiagnosticInfo error={`Database error: ${venueError.message}`} venueId={params.venueId} />
          </div>
        </div>
      );
    }

    if (!venue) {
      console.log('[LIVE-ORDERS] User does not own venue, redirecting to dashboard');
      redirect('/dashboard');
    }

    console.log('[LIVE-ORDERS] All checks passed, rendering component...');
    console.log('[LIVE-ORDERS] Venue:', { id: venue.venue_id, name: venue.name });

    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader
            title={`Live Orders for ${venue.name}`}
            description="Monitor and manage real-time orders"
            venueId={params.venueId}
          />
          
          <GlobalErrorBoundary>
            <ErrorBoundary>
              <LiveOrdersClient venueId={params.venueId} venueName={venue.name} />
            </ErrorBoundary>
          </GlobalErrorBoundary>
        </div>
      </div>
    );
  } catch (error) {
    console.error('[LIVE-ORDERS] Unexpected server error:', error);
    console.error('[LIVE-ORDERS] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PageHeader
            title="Live Orders"
            description="Monitor and manage real-time orders"
            venueId={params.venueId}
          />
          <DiagnosticInfo 
            error={`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`} 
            venueId={params.venueId} 
          />
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">Full Error Details:</h4>
            <pre className="text-xs text-gray-600 overflow-auto">
              {error instanceof Error ? error.stack : JSON.stringify(error, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }
}