'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Clock, 
  ShoppingBag, 
  QrCode
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { createClient } from '@/lib/supabase/client';

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
  badge?: number;
  isActive?: boolean;
}

export default function GlobalBottomNav({ venueId, counts = {} }: GlobalBottomNavProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [liveOrdersCount, setLiveOrdersCount] = useState(counts.live_orders || 0);
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  // Show/hide navigation based on scroll
  useEffect(() => {
    if (!isMobile) return;

    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show nav when scrolling up or at top
      if (currentScrollY < lastScrollY || currentScrollY < 100) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 200) {
        // Hide nav when scrolling down (except at very top)
        setIsVisible(false);
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMobile]);

  // Update live orders count in real-time
  useEffect(() => {
    if (!venueId) return;

    const supabase = createClient();
    const channel = supabase
      .channel('live-orders-count')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `venue_id=eq.${venueId}`
        }, 
        async () => {
          // Refresh live orders count
          try {
            const { data, error } = await supabase
              .rpc('dashboard_counts', { 
                p_venue_id: venueId, 
                p_tz: 'Europe/London', 
                p_live_window_mins: 30 
              })
              .single();
            
            if (!error && data) {
              setLiveOrdersCount(data.live_count || 0);
            }
          } catch (error) {
            // Silent error handling
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  // Determine if we're on dashboard pages
  const isOnDashboard = pathname?.startsWith('/dashboard');
  const isOnHomePage = pathname === '/';
  const isOnQRPage = pathname?.includes('/generate-qr');

  // Extract venueId from pathname if not provided
  const currentVenueId = venueId || pathname?.match(/\/dashboard\/([^/]+)/)?.[1];

  const navItems: NavItem[] = [
    {
      id: 'home',
      label: isOnDashboard ? 'Home' : 'Dashboard',
      href: isOnDashboard ? '/' : (currentVenueId ? `/dashboard/${currentVenueId}` : '/dashboard'),
      icon: Home,
      isActive: isOnHomePage || (isOnDashboard && pathname === `/dashboard/${currentVenueId}`)
    },
    {
      id: 'live-orders',
      label: 'Live Orders',
      href: currentVenueId ? `/dashboard/${currentVenueId}/live-orders` : '/dashboard',
      icon: Clock,
      badge: liveOrdersCount,
      isActive: pathname === `/dashboard/${currentVenueId}/live-orders`
    },
    {
      id: 'menu',
      label: 'Menu',
      href: currentVenueId ? `/dashboard/${currentVenueId}/menu` : '/dashboard',
      icon: ShoppingBag,
      isActive: pathname === `/dashboard/${currentVenueId}/menu`
    },
    {
      id: 'qr-codes',
      label: 'QR Codes',
      href: currentVenueId ? `/generate-qr?venue=${currentVenueId}` : '/generate-qr',
      icon: QrCode,
      isActive: pathname === '/generate-qr'
    }
  ];

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  const activeItem = navItems.find(item => item.isActive);

  if (!isMobile) return null;

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="grid grid-cols-4 h-20">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.href)}
              className={`flex flex-col items-center justify-center p-2 relative ${
                item.isActive 
                  ? 'text-purple-600 bg-purple-50' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="relative mb-1">
                <item.icon className="h-5 w-5" />
                {item.badge && item.badge > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </Badge>
                )}
              </div>
              <span className="text-xs leading-tight text-center px-1" style={{ lineHeight: '1.1', fontSize: '11px' }}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Page Indicator for Active Section */}
      {activeItem && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-30 transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}>
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 shadow-lg">
            <div className="flex items-center space-x-2">
              <activeItem.icon className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">
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