export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { safeGetUser } from '@/lib/server-utils';
import { log } from '@/lib/debug';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import OrdersClient from './OrdersClient';
import { liveOrdersWindow } from '@/lib/dates';

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  
  const { data: { user } } = await safeGetUser();
  if (!user) return null;
  
  log('ORDERS SSR user', { hasUser: !!user });

  const supabase = await createServerSupabase();

  // Verify user owns this venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, venue_name')
    .eq('venue_id', venueId)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (!venue) redirect('/dashboard');

  // Fetch all orders data server-side to prevent client-side loading
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false });


  // Calculate stats server-side (for live orders only)
  const timeWindow = liveOrdersWindow();
  const liveOrders = (ordersData || []).filter((order: any) => 
    new Date(order.created_at) >= new Date(timeWindow.startUtcISO)
  );
  
  const stats = {
    todayOrders: liveOrders.length,
    revenue: liveOrders.reduce((sum: number, order: any) => {
      let amount = order.total_amount;
      if (!amount || amount <= 0) {
        amount = order.items.reduce((itemSum: number, item: any) => {
          const quantity = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          return itemSum + (quantity * price);
        }, 0);
      }
      return sum + amount;
    }, 0)
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Orders for {venue.venue_name}
          </h1>
          <p className="text-lg text-foreground mt-2">
            View and manage all orders
          </p>
        </div>
        
        <OrdersClient venueId={venueId} initialOrders={ordersData || []} initialStats={stats} />
      </div>
    </div>
  );
}
