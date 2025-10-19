"use client";

import { usePathname } from 'next/navigation';
import GlobalBottomNav from './GlobalBottomNav';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

export default function ConditionalBottomNav() {
  const pathname = usePathname();
  const [venueId, setVenueId] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    live_orders: 0,
    total_orders: 0,
    notifications: 0
  });

  // Don't show bottom nav on customer-facing pages, auth pages, or home page
  const isCustomerOrderPage = pathname?.startsWith('/order');
  const isPaymentPage = pathname?.startsWith('/payment');
  const isOrderSummaryPage = pathname?.startsWith('/order-summary');
  const isOrderTrackingPage = pathname?.startsWith('/order-tracking');
  const isHomePage = pathname === '/';
  const isAuthPage = pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up') || pathname?.startsWith('/auth');
  const isCompleteProfilePage = pathname?.startsWith('/complete-profile');
  
  const shouldHide = isCustomerOrderPage || isPaymentPage || isOrderSummaryPage || isOrderTrackingPage || isHomePage || isAuthPage || isCompleteProfilePage;

  // Get venue ID from pathname and set up real-time updates - MUST be called before any returns
  useEffect(() => {
    const venueIdFromPath = pathname?.match(/\/dashboard\/([^/]+)/)?.[1];
    if (!venueIdFromPath) return;
    
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

    // Set up real-time subscription for order updates
    const supabase = createClient();
    const channel = supabase
      .channel(`bottom-nav-${venueIdFromPath}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `venue_id=eq.${venueIdFromPath}`
      }, () => {
        logger.debug('[BOTTOM NAV] Order update received, refreshing counts');
        loadCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pathname]);

  // Return null AFTER all hooks have been called
  if (shouldHide) {
    return null;
  }

  return <GlobalBottomNav venueId={venueId || undefined} counts={counts} />;
}