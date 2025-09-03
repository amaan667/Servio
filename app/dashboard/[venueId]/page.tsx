export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { hasServerAuthCookie } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import DashboardClient from './page.client';
import { todayWindowForTZ } from '@/lib/time';

export default async function VenuePage({ params }: { params: { venueId: string } }) {
  try {
    // Check for auth cookies before making auth calls
    const hasAuthCookie = await hasServerAuthCookie();
    if (!hasAuthCookie) {
      redirect('/sign-in');
    }

    const supabase = await createServerSupabase();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    log('VENUE PAGE SSR user', { hasUser: !!user, error: userError?.message });
    
    if (userError) {
      console.error('Auth error:', userError);
      redirect('/sign-in');
    }
    
    if (!user) {
      redirect('/sign-in');
    }

    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('*')
      .eq('venue_id', params.venueId)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (venueError) {
      console.error('Database error:', venueError);
      redirect('/?auth_error=database_error');
    }
    
    if (!venue) {
      // Check if user has any venues at all before redirecting to sign-in
      const { data: userVenues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', user.id)
        .limit(1);
      
      if (userVenues && userVenues.length > 0) {
        // User has venues but not this specific one - redirect to their first venue
        redirect(`/dashboard/${userVenues[0].venue_id}`);
      } else {
        // User has no venues - redirect to complete profile
        redirect('/complete-profile');
      }
    }

    // Get authoritative dashboard counts from the new RPC function
    const venueTz = 'Europe/London'; // pull from DB/config if you store it
    const { data: counts, error: countsError } = await supabase
      .rpc('dashboard_counts', { 
        p_venue_id: params.venueId, 
        p_tz: venueTz, 
        p_live_window_mins: 30 
      })
      .single();

    if (countsError) {
      console.error('Error fetching dashboard counts:', countsError);
      // Continue with default counts rather than failing
    }

    // Calculate today's revenue on the server-side to prevent flickering
    const todayWindow = todayWindowForTZ(venueTz);
    const { data: todayOrders } = await supabase
      .from("orders")
      .select("total_amount, status, payment_status, items")
      .eq("venue_id", params.venueId)
      .gte("created_at", todayWindow.startUtcISO)
      .lt("created_at", todayWindow.endUtcISO);

    // Calculate revenue from today's orders (all are now paid since they only appear after payment)
    const todayRevenue = (todayOrders ?? []).reduce((sum: number, order: any) => {
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
      .eq("venue_id", params.venueId)
      .eq("available", true);

    const initialStats = {
      revenue: todayRevenue,
      menuItems: menuItems?.length || 0,
      unpaid: 0, // All orders are now paid since they only appear after payment
    };

    console.log('[VENUE PAGE] Dashboard counts:', counts);
    console.log('[VENUE PAGE] Initial stats:', initialStats);

    console.log('[VENUE PAGE] Rendering dashboard client');
    return (
      <DashboardClient 
        venueId={params.venueId} 
        userId={user.id}
        venue={venue}
        userName={user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
        venueTz={venueTz}
        initialCounts={counts}
        initialStats={initialStats}
      />
    );
  } catch (error) {
    console.error('[VENUE PAGE] Error in venue page:', error);
    redirect('/sign-in');
  }
}
