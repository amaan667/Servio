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
  venueId: string;
  userRole: UserRole;
  userName: string;
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
    if (path.includes("/receipts")) return "Receipts";
    if (path.includes("/ai-chat")) return "AI Assistant";
    return "Dashboard";
  };

  const currentPage = getPageName();
  const isDashboard = currentPage === "Dashboard";

  // Navigation items definition (currently unused but kept for future use)

  const navigationItems = [
    {
      label: "Dashboard",
      href: `/dashboard/${venueId}`,
      icon: LayoutDashboard,
      feature: "dashboard",
      show: canAccess(userRole, "dashboard"),
    },
    {
      label: "Analytics",
      href: `/dashboard/${venueId}/analytics`,
      icon: BarChart,
      feature: "analytics",
      show: canAccess(userRole, "analytics"),
    },
    {
      label: "Menu",
      href: `/dashboard/${venueId}/menu-management`,
      icon: Menu,
      feature: "menu",
      show: canAccess(userRole, "menu"),
    },
    {
      label: "Inventory",
      href: `/dashboard/${venueId}/inventory`,
      icon: Package,
      feature: "inventory",
      show: canAccess(userRole, "inventory"),
    },
    {
      label: "Staff",
      href: `/dashboard/${venueId}/staff`,
      icon: Users,
      feature: "staff",
      show: canAccess(userRole, "staff"),
    },
    {
      label: "KDS",
      href: `/dashboard/${venueId}/kds`,
      icon: ChefHat,
      feature: "kds",
      show: canAccess(userRole, "kds"),
    },
    {
      label: "Tables",
      href: `/dashboard/${venueId}/tables`,
      icon: Table,
      feature: "tables",
      show: canAccess(userRole, "tables"),
    },
    {
      label: "POS",
      href: `/dashboard/${venueId}/pos`,
      icon: CreditCard,
      feature: "payments",
      show: canAccess(userRole, "payments"),
    },
    {
      label: "Receipts",
      href: `/dashboard/${venueId}/receipts`,
      icon: Receipt,
      feature: "payments",
      show: canAccess(userRole, "payments"),
    },
    {
      label: "Settings",
      href: `/dashboard/${venueId}/settings`,
      icon: Settings,
      feature: "settings",
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
