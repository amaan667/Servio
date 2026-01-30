"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Clock, ShoppingBag, QrCode, LayoutDashboard } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { getRealtimeChannelName } from "@/lib/realtime-device-id";

import { getCachedCounts, setCachedCounts } from "@/lib/cache/count-cache";

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

export default function GlobalBottomNav({
  venueId,
  counts = {
    /* Empty */
  },
}: GlobalBottomNavProps) {
  const [isVisible, setIsVisible] = useState(true);
  // Initialize with cached data if available, otherwise use props
  const [liveOrdersCount, setLiveOrdersCount] = useState(() => {
    if (venueId) {
      const cached = getCachedCounts(venueId);
      if (cached?.live_count !== undefined) {
        return cached.live_count;
      }
    }
    return counts.live_orders || 0;
  });
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const isMountedRef = useRef(true);

  // Determine if we're on dashboard pages
  const isOnDashboard = pathname?.startsWith("/dashboard");
  const isOnHomePage = pathname === "/";
  const isOnQRPage = pathname?.includes("/qr-codes");
  const shouldShowNav = isOnDashboard || isOnQRPage;

  // Check if we're on the dashboard root page (not a feature page)
  const isDashboardRoot = pathname?.match(/^\/dashboard\/(?:[^/]+)\/?$/);
  const isOnFeaturePage = isOnDashboard && !isDashboardRoot;

  // Extract venueId from pathname if not provided
  const currentVenueId = venueId || pathname?.match(/\/dashboard\/([^/]+)/)?.[1];

  const showDashboardForHome = isOnFeaturePage || isOnQRPage;

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

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile, shouldShowNav]);

  // Update live orders count in real-time
  useEffect(() => {
    if (!venueId || !shouldShowNav) return;

    let isSubscribed = true;
    let debounceTimeout: NodeJS.Timeout | null = null;
    const supabase = createClient();

    const channelName = getRealtimeChannelName("live-orders-count", venueId);
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        async (payload) => {
          if (!isSubscribed || !isMountedRef.current) return;

          // For INSERT events (new orders), update immediately
          // For UPDATE/DELETE events, use debounced update
          const updateCounts = async () => {
            if (!isSubscribed || !isMountedRef.current) return;

            try {
              const params = new URLSearchParams({
                venueId,
                tz: "Europe/London",
                live_window_mins: "30",
              });
              const res = await fetch(`/api/dashboard/counts?${params.toString()}`, {
                credentials: "include",
                headers: { Accept: "application/json" },
              });

              if (!isSubscribed || !isMountedRef.current) return;

              const body = res.ok ? await res.json() : null;
              const data = body?.data ?? body;
              if (
                data &&
                typeof data === "object" &&
                data !== null &&
                "live_count" in data
              ) {
                const liveCount = (data as { live_count?: number }).live_count;
                setLiveOrdersCount(liveCount || 0);

                // Update cache to keep it in sync
                const cached = getCachedCounts(venueId);
                if (cached) {
                  setCachedCounts(venueId, {
                    ...cached,
                    live_count: liveCount || 0,
                  });
                } else if (data) {
                  // Cache the full result if we don't have cached data
                  setCachedCounts(
                    venueId,
                    data as {
                      live_count?: number;
                      earlier_today_count?: number;
                      history_count?: number;
                      today_orders_count?: number;
                      active_tables_count?: number;
                      tables_set_up?: number;
                      tables_in_use?: number;
                      tables_reserved_now?: number;
                      in_use_now?: number;
                      reserved_now?: number;
                      reserved_later?: number;
                      waiting?: number;
                    }
                  );
                }
              }
            } catch {
              // Silent error handling
            }
          };

          if (payload.eventType === "INSERT") {
            // Immediate update for new orders
            updateCounts();
          } else {
            // Debounced update for updates/deletes
            if (debounceTimeout) {
              clearTimeout(debounceTimeout);
            }
            debounceTimeout = setTimeout(updateCounts, 300);
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [venueId, shouldShowNav]);

  const navItems: NavItem[] = [
    {
      id: "home",
      label: showDashboardForHome ? "Dashboard" : "Home",
      href: showDashboardForHome ? (currentVenueId ? `/dashboard/${currentVenueId}` : "/") : "/",
      icon: showDashboardForHome ? LayoutDashboard : Home,
      isActive: isOnHomePage || (isOnDashboard && pathname === `/dashboard/${currentVenueId}`),
    },
    {
      id: "live-orders",
      label: "Live Orders",
      href: currentVenueId ? `/dashboard/${currentVenueId}/live-orders` : "/",
      icon: Clock,
      isActive: pathname === `/dashboard/${currentVenueId}/live-orders`,
    },
    {
      id: "menu",
      label: "Menu",
      href: currentVenueId ? `/dashboard/${currentVenueId}/menu-management` : "/",
      icon: ShoppingBag,
      isActive: pathname === `/dashboard/${currentVenueId}/menu-management`,
    },
    {
      id: "qr-codes",
      label: "QR Codes",
      href: currentVenueId ? `/dashboard/${currentVenueId}/qr-codes` : "/",
      icon: QrCode,
      isActive: pathname === `/dashboard/${currentVenueId}/qr-codes`,
    },
  ];

  const handleNavigation = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  const activeItem = navItems.find((item) => item.isActive);

  if (!isMobile || !shouldShowNav) return null;

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-gray-200 shadow-lg transition-transform duration-300 mobile-nav ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          className="grid grid-cols-4 gap-2 px-3 py-3 items-stretch"
          style={{ minHeight: "88px" }}
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.href)}
              className={`flex flex-col items-center justify-center gap-2 py-2 px-1 transition-all duration-200 rounded-lg active:scale-95 ${
                item.isActive
                  ? "border-2 border-purple-500 shadow-[0_0_16px_rgba(124,58,237,0.5)]"
                  : "border border-gray-200"
              }`}
              style={{ minHeight: "72px", backgroundColor: "#ffffff" }}
            >
              <item.icon
                className={`w-6 h-6 flex-shrink-0 ${
                  item.isActive ? "text-purple-600" : "text-purple-400"
                }`}
              />
              <p
                style={{
                  fontSize: "11px",
                  lineHeight: "1.2",
                  fontWeight: 500,
                  color: item.isActive ? "#7c3aed" : "#a855f7",
                  margin: 0,
                  padding: 0,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {item.id === "live-orders" ? `Orders` : item.label}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Page Indicator for Active Section */}
      {activeItem && (
        <div
          className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-40 transition-transform duration-300 ${
            isVisible ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <div className="bg-white rounded-md px-3 py-1 shadow-sm transition-all duration-200">
            <div className="flex items-center space-x-2">
              <activeItem.icon className="h-4 w-4 text-gray-700" />
              <span className="text-sm font-medium text-gray-700">{activeItem.label}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Padding for Fixed Navigation */}
      <div className="h-24" />
    </>
  );
}
