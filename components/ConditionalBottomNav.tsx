"use client";

import { usePathname } from 'next/navigation';
import GlobalBottomNav from './GlobalBottomNav';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function ConditionalBottomNav() {
  const pathname = usePathname();
  const [venueId, setVenueId] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    live_orders: 0,
    total_orders: 0,
    notifications: 0
  });

  // Don't show bottom nav on customer-facing pages
  const isCustomerOrderPage = pathname?.startsWith('/order');
  const isCheckoutPage = pathname?.startsWith('/checkout');
  const isPaymentPage = pathname?.startsWith('/payment');
  const isOrderSummaryPage = pathname?.startsWith('/order-summary');
  const isOrderTrackingPage = pathname?.startsWith('/order-tracking');
  
  if (isCustomerOrderPage || isCheckoutPage || isPaymentPage || isOrderSummaryPage || isOrderTrackingPage) {
    return null;
  }

  // Get venue ID from pathname
  useEffect(() => {
    const venueIdFromPath = pathname?.match(/\/dashboard\/([^/]+)/)?.[1];
    if (venueIdFromPath) {
      setVenueId(venueIdFromPath);
      
      // Load counts for the venue
      const loadCounts = async () => {
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .rpc('dashboard_counts', { 
              p_venue_id: venueIdFromPath, 
              p_tz: 'Europe/London', 
              p_live_window_mins: 30 
            })
            .single();
          
          if (!error && data) {
            setCounts({
              live_orders: data.live_count || 0,
              total_orders: data.today_orders_count || 0,
              notifications: 0
            });
          }
        } catch (error) {
          // Silent error handling
        }
      };

      loadCounts();
    }
  }, [pathname]);

  return <GlobalBottomNav venueId={venueId || undefined} counts={counts} />;
}