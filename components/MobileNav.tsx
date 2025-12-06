"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Menu,
  X,
  Home,
  ShoppingBag,
  BarChart,
  QrCode,
  Users,
  Settings,
  Clock,
  Table,
  MessageSquare,
  ChevronRight,
  Bell,
  Receipt,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeNavigation } from "@/hooks/useGestures";

interface MobileNavProps {
  venueId: string;
  venueName?: string;
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
  description?: string;
  isActive?: boolean;
}

export default function MobileNav({
  venueId,
  venueName,
  counts = {
    /* Empty */
  },
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
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

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  const navItems: NavItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      href: `/dashboard/${venueId}`,
      icon: Home,
      description: "Overview and quick stats",
      isActive: pathname === `/dashboard/${venueId}` || pathname === `/dashboard/${venueId}/`,
    },
    {
      id: "orders",
      label: "Live Orders",
      href: `/dashboard/${venueId}/live-orders`,
      icon: Clock,
      badge: counts.live_orders,
      description: "Monitor incoming orders",
      isActive: pathname === `/dashboard/${venueId}/live-orders`,
    },
    {
      id: "menu",
      label: "Menu Builder",
      href: `/dashboard/${venueId}/menu-management`,
      icon: ShoppingBag,
      description: "Design, manage, and customize menu",
      isActive: pathname === `/dashboard/${venueId}/menu-management`,
    },
    {
      id: "qr",
      label: "QR Codes",
      href: `/dashboard/${venueId}/qr-codes`,
      icon: QrCode,
      description: "Generate table QR codes",
      isActive: pathname === `/dashboard/${venueId}/qr-codes`,
    },
    {
      id: "tables",
      label: "Tables",
      href: `/dashboard/${venueId}/tables`,
      icon: Table,
      description: "Table management",
      isActive: pathname === `/dashboard/${venueId}/tables`,
    },
    {
      id: "analytics",
      label: "Analytics",
      href: `/dashboard/${venueId}/analytics`,
      icon: BarChart,
      description: "Business insights",
      isActive: pathname === `/dashboard/${venueId}/analytics`,
    },
    {
      id: "staff",
      label: "Staff",
      href: `/dashboard/${venueId}/staff`,
      icon: Users,
      description: "Staff management",
      isActive: pathname === `/dashboard/${venueId}/staff`,
    },
    {
      id: "feedback",
      label: "Feedback",
      href: `/dashboard/${venueId}/feedback`,
      icon: MessageSquare,
      badge: counts.notifications,
      description: "Customer feedback",
      isActive: pathname === `/dashboard/${venueId}/feedback`,
    },
    {
      id: "payments",
      label: "Payments",
      href: `/dashboard/${venueId}/payments`,
      icon: Receipt,
      description: "Manage payments, split bills, and view receipts",
      isActive: pathname === `/dashboard/${venueId}/payments`,
    },
    {
      id: "settings",
      label: "Settings",
      href: `/dashboard/${venueId}/settings`,
      icon: Settings,
      description: "Venue settings",
      isActive: pathname === `/dashboard/${venueId}/settings`,
    },
  ];

  const handleNavigation = (href: string) => {
    router.push(href);
    setIsOpen(false);
  };

  const activeItem = navItems.find((item) => item.isActive);

  if (!isMobile) return null;

  return (
    <>
      {/* Bottom Navigation Bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-gray-200 transition-transform duration-300 shadow-lg ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4 h-20 gap-2 px-2">
          {navItems.slice(0, 4).map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.href)}
              className={`flex flex-col items-center justify-center p-2 relative rounded-lg transition-all duration-200 bg-white border ${
                item.isActive
                  ? "shadow-[0_0_12px_rgba(124,58,237,0.4)] ring-2 ring-purple-200 border-transparent"
                  : "border-purple-100 hover:border-purple-200 hover:shadow-[0_0_6px_rgba(124,58,237,0.25)]"
              }`}
            >
              <div className="relative mb-1">
                <item.icon 
                  className={`h-5 w-5 transition-colors ${
                    item.isActive ? "text-purple-700" : "text-purple-600"
                  }`}
                />
                {item.badge && item.badge > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </Badge>
                )}
              </div>
              <span
                className={`text-xs leading-tight text-center px-1 font-bold max-w-[60px] truncate transition-colors ${
                  item.isActive ? "text-purple-700" : "text-purple-600"
                }`}
                style={{ 
                  lineHeight: "1.2", 
                  fontSize: "10px",
                  color: item.isActive ? "#6d28d9" : "#7c3aed",
                  fontWeight: item.isActive ? 700 : 600,
                }}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {/* More Button */}
        <div className="absolute top-0 right-0 h-16 w-16 flex items-center justify-center">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-12 w-12 rounded-full">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <div className="flex flex-col h-full">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{venueName || "Home"}</h2>
                      <p className="text-sm text-gray-700 font-medium">Quick navigation</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4 space-y-2">
                    {navItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleNavigation(item.href)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors ${
                          item.isActive
                            ? "bg-purple-100 text-purple-800 border-2 border-purple-300"
                            : "hover:bg-gray-50 text-gray-900 font-bold"
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <item.icon
                              className={`h-6 w-6 ${
                                item.isActive ? "text-purple-600" : "text-gray-700"
                              }`}
                            />
                            {item.badge && item.badge > 0 && (
                              <Badge
                                variant="destructive"
                                className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
                                style={{ color: "white" }}
                              >
                                {item.badge > 99 ? "99+" : item.badge}
                              </Badge>
                            )}
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-gray-900">{item.label}</div>
                            <div className="text-sm text-gray-700 font-medium">
                              {item.description}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-500" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200">
                  <div className="text-center">
                    <p className="text-xs text-gray-600 font-medium">Servio Home</p>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Page Indicator for Active Section */}
      {activeItem && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-30 transition-transform duration-300 ${
            isVisible ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <div className="bg-purple-600 backdrop-blur-md border-2 border-purple-300 rounded-full px-4 py-2 shadow-lg">
            <div className="flex items-center space-x-2">
              <activeItem.icon className="h-4 w-4 text-white" />
              <span className="text-sm font-bold text-white">{activeItem.label}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Padding for Fixed Navigation */}
      <div className="h-20" />
    </>
  );
}
