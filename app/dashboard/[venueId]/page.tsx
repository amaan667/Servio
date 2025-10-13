export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardClient from './page.client';
import { todayWindowForTZ } from '@/lib/time';

export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/sign-in');
  }
  
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('*')
    .eq('venue_id', venueId)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (venueError) {
    redirect('/complete-profile');
  }
  
  if (!venue) {
    const { data: userVenues } = await supabase
      .from('venues')
      .select('venue_id, created_at')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: true });
    
    if (userVenues && userVenues.length > 0) {
      redirect(`/dashboard/${userVenues[0].venue_id}`);
    }
    redirect('/complete-profile');
  }

  // Get dashboard counts
  const venueTz = 'Europe/London';
  const { data: counts } = await supabase
    .rpc('dashboard_counts', { 
      p_venue_id: venueId, 
      p_tz: venueTz, 
      p_live_window_mins: 30 
    })
    .single();

  // Get table counters
  const { data: tableCounters } = await supabase
    .rpc('api_table_counters', {
      p_venue_id: venueId
    });

  // Use table counters data to override dashboard counts for consistency
  const tableCounter = tableCounters?.[0];
  if (tableCounter && counts) {
    (counts as any).tables_set_up = Number(tableCounter.total_tables) || 0;
    (counts as any).tables_in_use = Number(tableCounter.occupied) || 0;
    (counts as any).active_tables_count = Number(tableCounter.total_tables) || 0;
  }

  // Calculate today's revenue
  const todayWindow = todayWindowForTZ(venueTz);
  const { data: todayOrdersForRevenue } = await supabase
    .from("orders")
    .select("total_amount, order_status, payment_status, items")
    .eq("venue_id", venueId)
    .gte("created_at", todayWindow.startUtcISO)
    .lt("created_at", todayWindow.endUtcISO);

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
    unpaid: 0,
  };

  return (
    <DashboardClient 
      venueId={venueId} 
      userId={user.id}
      venue={venue}
      userName={user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
      venueTz={venueTz}
      initialCounts={counts as any}
      initialStats={initialStats}
    />
  );
}