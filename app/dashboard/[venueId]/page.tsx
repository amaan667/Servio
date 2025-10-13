export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import DashboardClient from './page.client.simple';
import { todayWindowForTZ } from '@/lib/time';
import { EnhancedErrorBoundary } from '@/components/enhanced-error-boundary';

export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  
  try {
    const supabase = await createServerSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    log('VENUE PAGE SSR user', { hasUser: !!user });
    
    if (!user) {
      console.log('[VENUE PAGE] No user found, redirecting to home');
      redirect('/');
    }

    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('*')
      .eq('venue_id', venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (venueError) {
      console.error('Database error:', venueError);
      redirect('/?auth_error=database_error');
    }
    
    if (!venue) {
      const { data: userVenues } = await supabase
        .from('venues')
        .select('venue_id, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });
      
      if (userVenues && userVenues.length > 0) {
        // Redirect to main venue (first one created)
        redirect(`/dashboard/${userVenues[0].venue_id}`);
      }
      console.log('[VENUE PAGE] No venues found for user, redirecting to home');
      redirect('/');
    }

    // Dashboard should always load - no onboarding redirects
    // Users can access dashboard even without menu/tables set up
    console.log('[VENUE PAGE] Loading dashboard for venue:', venueId);

    // Get authoritative dashboard counts from the new RPC function
    const venueTz = 'Europe/London'; // pull from DB/config if you store it
    const { data: counts, error: countsError } = await supabase
      .rpc('dashboard_counts', { 
        p_venue_id: venueId, 
        p_tz: venueTz, 
        p_live_window_mins: 30 
      })
      .single();

    if (countsError) {
      console.error('Error fetching dashboard counts:', countsError);
      // Continue with default counts rather than failing
    }

    // The RPC function now includes both PAID and UNPAID orders, so no manual calculation needed

    // Get table counters using the same function as other pages for consistency
    const { data: tableCounters, error: tableCountersError } = await supabase
      .rpc('api_table_counters', {
        p_venue_id: venueId
      });

    if (tableCountersError) {
      console.error('Error fetching table counters:', tableCountersError);
    }

    // Use table counters data to override dashboard counts for consistency
    const tableCounter = tableCounters?.[0];
    if (tableCounter && counts) {
      counts.tables_set_up = Number(tableCounter.total_tables) || 0;
      counts.tables_in_use = Number(tableCounter.occupied) || 0;
      counts.active_tables_count = Number(tableCounter.total_tables) || 0;
    }

    // Calculate today's revenue on the server-side to prevent flickering
    const todayWindow = todayWindowForTZ(venueTz);
    const { data: todayOrdersForRevenue } = await supabase
      .from("orders")
      .select("total_amount, order_status, payment_status, items")
      .eq("venue_id", venueId)
      .gte("created_at", todayWindow.startUtcISO)
      .lt("created_at", todayWindow.endUtcISO);

    // Calculate revenue from today's orders (all are now paid since they only appear after payment)
    const todayRevenue = (todayOrdersForRevenue ?? []).reduce((sum: number, order: any) => {
      let amount = Number(order.total_amount) || parseFloat(order.total_amount as any) || 0;
      if (!Number.isFinite(amount) || amount <= 0) {
        if (Array.isArray(order.items)) {
          amount = order.items.reduce((s: number, it: any) => {
            const unit = Number(it.unit_price ?? it.price ?? 0);
            const qty = Number(it.quantity ?? it.qty ?? 0);
            return s + (Number.isFinite(unit) && Number.isFinite(qty) ? unit * qty : 0);
          }, 0);
        }
      }
      // All orders are now paid since they only appear after payment
      return sum + amount;
    }, 0);

    // Get menu items count
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("id")
      .eq("venue_id", venueId)
      .eq("is_available", true);

    const initialStats = {
      revenue: todayRevenue,
      menuItems: menuItems?.length || 0,
      unpaid: 0, // All orders are now paid since they only appear after payment
    };

    return (
      <DashboardClient 
        venueId={venueId} 
        userId={user.id}
        venue={venue}
        userName={user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
        venueTz={venueTz}
        initialCounts={counts}
        initialStats={initialStats}
      />
    );
  } catch (error: any) {
    // Check if this is a Next.js redirect (which is expected)
    if (error?.message === 'NEXT_REDIRECT') {
      throw error; // Re-throw redirects so they work properly
    }
    
    console.error('[VENUE PAGE] Error:', error);
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-red-600 mb-6">
            ❌ Dashboard Error
          </h1>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-semibold">Error loading dashboard:</p>
            <p>{String(error)}</p>
          </div>
        </div>
      </div>
    );
  }
}
