"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { LucideIcon, Clock, ShoppingBag, QrCode, BarChart, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import RoleManagementPopup from "@/components/role-management-popup";
import VenueSwitcherPopup from "@/components/venue-switcher-popup";

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  variant?: "default" | "outline" | "ghost";
  color?: string;
}

interface QuickActionsToolbarProps {
  venueId: string;
  userRole?: string;
  onVenueChange?: (venueId: string) => void;
}

export function QuickActionsToolbar({
  venueId,
  userRole,
  onVenueChange,
}: QuickActionsToolbarProps) {
  // Track role changes
  useEffect(() => {
  }, [userRole]);

  const actions: QuickAction[] = [
    {
      label: "Live Orders",
      href: `/dashboard/${venueId}/live-orders`,
      icon: Clock,
      description: "View orders",
      color: "bg-purple-600 hover:bg-purple-700",
    },
    {
      label: "Menu",
      href: `/dashboard/${venueId}/menu-management`,
      icon: ShoppingBag,
      description: "Edit menu",
      color: "bg-orange-600 hover:bg-orange-700",
    },
    {
      label: "QR Codes",
      href: `/dashboard/${venueId}/qr-codes`,
      icon: QrCode,
      description: "Generate QR",
      color: "bg-green-600 hover:bg-green-700",
    },
  ];

  if (userRole === "owner" || userRole === "manager") {
    actions.push({
      label: "Analytics",
      href: `/dashboard/${venueId}/analytics`,
      icon: BarChart,
      description: "View insights",
      color: "bg-indigo-600 hover:bg-indigo-700",
    });
  } else {

    // Block handled

  }

  if (userRole === "owner" || userRole === "manager" || userRole === "kitchen") {
    actions.push({
      label: "Kitchen",
      href: `/dashboard/${venueId}/kds`,
      icon: ChefHat,
      description: "Kitchen display",
      color: "bg-red-600 hover:bg-red-700",
    });
  } else {

    // Block handled

  }


  return (
    <TooltipProvider>
      <div className="sticky top-0 z-40 bg-gray-50/50 block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 py-5">
            {/* Left: Quick Actions */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
              {actions.map((action) => (
                <Link key={action.href} href={action.href} className="flex-shrink-0">
                  <button className="group flex items-center gap-2 px-3 py-2 h-10 bg-purple-600 hover:bg-white hover:border-purple-600 border-2 border-transparent transition-all duration-200 rounded-lg font-medium">
                    <action.icon className="h-4 w-4 text-white group-hover:text-purple-600 transition-colors" />
                    <span className="hidden sm:inline text-sm text-white group-hover:text-purple-600 transition-colors">
                      {action.label}
                    </span>
                  </button>
                </Link>
              ))}
            </div>

            {/* Right: Venue/Role Controls */}
            <div className="flex items-center gap-2 flex-shrink-0 py-1">
              <RoleManagementPopup />
              <VenueSwitcherPopup
                currentVenueId={venueId}
                onVenueChange={onVenueChange || (() => {})}
              />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
