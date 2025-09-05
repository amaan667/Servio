export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import GenerateQRClient from './GenerateQRClient';

export default async function GenerateQRPage() {
  try {
    console.log('🔍 [QR PAGE] ===== STARTING QR PAGE LOAD =====');
    console.log('🔍 [QR PAGE] Timestamp:', new Date().toISOString());
    
    // Check for auth cookies before making auth calls
    const hasAuthCookie = await hasServerAuthCookie();
    console.log('🔍 [QR PAGE] Has auth cookie:', hasAuthCookie);
    if (!hasAuthCookie) {
      console.log('🔍 [QR PAGE] No auth cookie, redirecting to sign-in');
      redirect('/sign-in');
    }

    const supabase = await createServerSupabase();
    console.log('🔍 [QR PAGE] Supabase client created successfully');

    const { data: { user } } = await supabase.auth.getUser();
    console.log('🔍 [QR PAGE] User authentication result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email
    });
    if (!user) {
      console.log('🔍 [QR PAGE] No user found, redirecting to sign-in');
      redirect('/sign-in');
    }

    console.log('🔍 [QR PAGE] Fetching venue data for user:', user.id);
    const { data: venue, error } = await supabase
      .from('venues')
      .select('venue_id, name')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle();

    console.log('🔍 [QR PAGE] Venue query result:', {
      hasVenue: !!venue,
      venueId: venue?.venue_id,
      venueName: venue?.name,
      error: error?.message
    });

    // Get today's orders to calculate active tables for QR codes
    const today = new Date(); 
    today.setHours(0,0,0,0);
    const startIso = today.toISOString();
    const endIso = new Date(today.getTime() + 24*60*60*1000).toISOString();
    
    console.log('🔍 [QR PAGE] Date range for orders:', {
      startIso,
      endIso,
      venueId: venue?.venue_id
    });
    
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('table_number, order_status, created_at')
      .eq('venue_id', venue.venue_id)
      .gte('created_at', startIso)
      .lt('created_at', endIso);

    console.log('🔍 [QR PAGE] Orders query result:', {
      ordersCount: orders?.length || 0,
      orders: orders?.map(o => ({
        table_number: o.table_number,
        order_status: o.order_status,
        created_at: o.created_at
      })),
      error: ordersError?.message
    });
    
    if (error) {
      console.error('🔍 [QR PAGE] Database error:', error);
      redirect('/complete-profile');
    }
    
    if (!venue) {
      console.log('🔍 [QR PAGE] No venue found, redirecting to complete-profile');
      redirect('/complete-profile');
    }

    console.log('🔍 [QR PAGE] ===== RENDERING QR PAGE COMPONENT =====');
    console.log('🔍 [QR PAGE] Props being passed to GenerateQRClient:', {
      venueId: venue.venue_id,
      venueName: venue.name,
      initialOrdersCount: orders?.length || 0
    });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <NavigationBreadcrumb venueId={venue.venue_id} />
        
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            QR Codes for {venue.name}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-2">
            Generate and manage QR codes for your tables
          </p>
        </div>
        
        <GenerateQRClient 
          venueId={venue.venue_id} 
          venueName={venue.name} 
          initialOrders={orders || []}
        />
      </div>
    </div>
  );
  } catch (error: any) {
    console.error('[QR PAGE] Error in GenerateQRPage:', error);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading QR Code Page</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}