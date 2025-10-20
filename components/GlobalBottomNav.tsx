'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Home,
  Clock,
  ShoppingBag,
  QrCode,
  LayoutDashboard
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { createClient } from '@/lib/supabase';

interface GlobalBottomNavProps {
  venueId?: string;
  counts?: {
    live_orders?: number;
    total_orders?: number;
    notifications?: number;
  };
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
}

export default function GlobalBottomNav({ venueId, counts = {} }: GlobalBottomNavProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [liveOrdersCount, setLiveOrdersCount] = useState(counts.live_orders || 0);
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const isMountedRef = useRef(true);

  // Determine if we're on dashboard pages
  const isOnDashboard = pathname?.startsWith('/dashboard');
  const isOnHomePage = pathname === '/';
  const isOnQRPage = pathname?.includes('/qr-codes');
  const shouldShowNav = isOnDashboard || isOnQRPage;

  // Check if we're on the dashboard root page (not a feature page)
  const isDashboardRoot = pathname?.match(/^\/dashboard\/(?:[^/]+)\/?$/);
  const isOnFeaturePage = isOnDashboard && !isDashboardRoot;

  // Extract venueId from pathname if not provided
  const currentVenueId = venueId || pathname?.match(/\/dashboard\/([^/]+)/)?.[1];

  const showDashboardForHome = (isOnFeaturePage || isOnQRPage);

  // Cleanup function
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Show/hide navigation based on scroll
  useEffect(() => {
    if (!isMobile || !shouldShowNav) {
      setIsVisible(true);
      return;
    }

    let lastScrollY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          // Show nav when scrolling up or at top
          if (currentScrollY < lastScrollY || currentScrollY < 100) {
            setIsVisible(true);
          } else if (currentScrollY > lastScrollY && currentScrollY > 200) {
            // Hide nav when scrolling down (except at very top)
            setIsVisible(false);
          }

          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile, shouldShowNav]);

  // Update live orders count in real-time
  useEffect(() => {
    if (!venueId || !shouldShowNav) return;

    let isSubscribed = true;
    const supabase = createClient();

    const channel = supabase
      .channel(`live-orders-count-${venueId}`)
      .on('postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        }, 
        async (payload: unknown) => {
          if (!isSubscribed || !isMountedRef.current) return;

          // Debounce the updates to prevent rapid state changes
          setTimeout(async () => {
            if (!isSubscribed || !isMountedRef.current) return;

            try {
              const { data, error } = await supabase
                .rpc('dashboard_counts', {
                  p_venue_id: venueId,
                  p_tz: 'Europe/London',
                  p_live_window_mins: 30
                })
                .single();

              if (!isSubscribed || !isMountedRef.current) return;

              if (!error && data) {
                setLiveOrdersCount(data.live_count || 0);
              }
            } catch (error) {
              // Silent error handling
            }
          }, 100);
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [venueId, shouldShowNav]);

  const navItems: NavItem[] = [
    {
      id: 'home',
      label: showDashboardForHome ? 'Dashboard' : 'Home',
      href: showDashboardForHome ? (currentVenueId ? `/dashboard/${currentVenueId}` : '/') : '/',
      icon: showDashboardForHome ? LayoutDashboard : Home,
      isActive: isOnHomePage || (isOnDashboard && pathname === `/dashboard/${currentVenueId}`)
    },
    {
      id: 'live-orders',
      label: 'Live Orders',
      href: currentVenueId ? `/dashboard/${currentVenueId}/live-orders` : '/',
      icon: Clock,
      isActive: pathname === `/dashboard/${currentVenueId}/live-orders`
    },
    {
      id: 'menu',
      label: 'Menu',
      href: currentVenueId ? `/dashboard/${currentVenueId}/menu-management` : '/',
      icon: ShoppingBag,
      isActive: pathname === `/dashboard/${currentVenueId}/menu-management`
    },
    {
      id: 'qr-codes',
      label: 'QR Codes',
      href: currentVenueId ? `/dashboard/${currentVenueId}/qr-codes` : '/',
      icon: QrCode,
      isActive: pathname === `/dashboard/${currentVenueId}/qr-codes`
    }
  ];

  const handleNavigation = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  const activeItem = navItems.find(item => item.isActive);

  if (!isMobile || !shouldShowNav) return null;

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg transition-transform duration-300 mobile-nav ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="grid grid-cols-4 h-20 gap-1 px-3 pb-2 pt-2 items-stretch">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.href)}
              className={`flex flex-col items-center justify-center p-1.5 relative transition-all duration-200 rounded-lg bg-white border border-servio-purple shadow-sm hover:shadow-md active:scale-95 h-full`}
            >
              <div className="relative mb-0.5 flex flex-col items-center justify-center">
                <item.icon className={`h-5 w-5 transition-colors text-servio-purple`} />
              </div>
              <span
                className={`text-servio-purple font-medium text-center px-0.5 transition-colors
                  leading-tight text-[10px] w-full flex items-center justify-center
                  whitespace-nowrap overflow-hidden`}
              >
                {item.id === 'live-orders' ? `Live (${liveOrdersCount})` : item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Page Indicator for Active Section */}
      {activeItem && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-40 transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}>
          <div className="bg-white border-2 border-servio-purple rounded-full px-4 py-3 shadow-lg">
            <div className="flex items-center space-x-2">
              <activeItem.icon className="h-5 w-5 text-servio-purple" />
              <span className="text-sm font-bold text-servio-purple">
                {activeItem.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Padding for Fixed Navigation */}
      <div className="h-20" />
    </>
  );
}