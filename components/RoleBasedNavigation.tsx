"use client";

import {
  LayoutDashboard,
  Settings,
  Users,
  Menu,
  BarChart,
  ChefHat,
  Table,
  CreditCard,
  Package,
  Receipt,
} from "lucide-react";
import { canAccess, getRoleDisplayName, getRoleColor, UserRole } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { usePathname } from "next/navigation";

interface RoleBasedNavigationProps {

}

export default function RoleBasedNavigation({
  venueId,
  userRole,
  userName,
}: RoleBasedNavigationProps) {
  const pathname = usePathname();

  // Get the current page name from the path
  const getPageName = () => {
    const path = pathname || "";
    if (path.includes("/analytics")) return "Analytics";
    if (path.includes("/menu-management")) return "Menu";
    if (path.includes("/inventory")) return "Inventory";
    if (path.includes("/staff")) return "Staff";
    if (path.includes("/kds")) return "KDS";
    if (path.includes("/tables")) return "Tables";
    if (path.includes("/pos")) return "POS";
    if (path.includes("/settings")) return "Settings";
    if (path.includes("/qr-codes")) return "QR Codes";
    if (path.includes("/feedback")) return "Feedback";
    if (path.includes("/live-orders")) return "Live Orders";
    if (path.includes("/orders")) return "Orders";
    if (path.includes("/payments")) return "Payments";
    if (path.includes("/ai-chat")) return "AI Assistant";
    return "Dashboard";
  };

  const currentPage = getPageName();
  const isDashboard = currentPage === "Dashboard";

  // Navigation items definition (currently unused but kept for future use)

  const navigationItems = [
    {

      href: `/dashboard/${venueId}`,

      show: canAccess(userRole, "dashboard"),
    },
    {

      href: `/dashboard/${venueId}/analytics`,

      show: canAccess(userRole, "analytics"),
    },
    {

      href: `/dashboard/${venueId}/menu-management`,

      show: canAccess(userRole, "menu"),
    },
    {

      href: `/dashboard/${venueId}/inventory`,

      show: canAccess(userRole, "inventory"),
    },
    {

      href: `/dashboard/${venueId}/staff`,

      show: canAccess(userRole, "staff"),
    },
    {

      href: `/dashboard/${venueId}/kds`,

      show: canAccess(userRole, "kds"),
    },
    {

      href: `/dashboard/${venueId}/tables`,

      show: canAccess(userRole, "tables"),
    },
    {

      href: `/dashboard/${venueId}/pos`,

      show: canAccess(userRole, "payments"),
    },
    {

      href: `/dashboard/${venueId}/payments`,

      show: canAccess(userRole, "payments"),
    },
    {

      href: `/dashboard/${venueId}/settings`,

      show: canAccess(userRole, "settings"),
    },
  ];

  // Ensure venueId is valid before rendering
  if (!venueId) {
    return null;
  }

  return (
    <div className="bg-white border-b">
      {/* Role Badge and User Name - Only show on dashboard */}
      {isDashboard && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <Badge className={getRoleColor(userRole)}>{getRoleDisplayName(userRole)}</Badge>
            <span className="text-sm text-gray-600">{userName}</span>
          </div>
        </div>
      )}
    </div>
  );
}
