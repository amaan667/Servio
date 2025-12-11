"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  LucideIcon,
  Clock,
  ShoppingBag,
  QrCode,
  BarChart,
  ChefHat,
  HelpCircle,
  MoreVertical,
  Lightbulb,
  Bug,
  MessageSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import RoleManagementPopup from "@/components/role-management-popup";
import VenueSwitcherPopup from "@/components/venue-switcher-popup";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SupportForm } from "./SupportForm";

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
  const isMobile = useIsMobile();
  const [supportFormOpen, setSupportFormOpen] = useState(false);
  const [supportFormType, setSupportFormType] = useState<"feature" | "bug">("feature");

  // Track role changes (must be before return)
  useEffect(() => {}, [userRole]);

  // Don't render until we know if mobile or desktop (prevents flicker)
  if (isMobile === undefined) {
    return null;
  }

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

  const isPrivileged = userRole === "owner" || userRole === "manager" || !userRole;

  if (isPrivileged) {
    actions.push({
      label: "Analytics",
      href: `/dashboard/${venueId}/analytics`,
      icon: BarChart,
      description: "View insights",
      color: "bg-indigo-600 hover:bg-indigo-700",
    });
    actions.push({
      label: "Feedback",
      href: `/dashboard/${venueId}/feedback`,
      icon: MessageSquare,
      description: "Customer feedback",
      color: "bg-pink-600 hover:bg-pink-700",
    });
    actions.push({
      label: "Settings",
      href: `/dashboard/${venueId}/settings`,
      icon: Settings,
      description: "Venue settings",
      color: "bg-gray-600 hover:bg-gray-700",
    });
  } else {
    // Block handled
  }

  if (isPrivileged || userRole === "kitchen") {
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
      <div className={cn("sticky top-0 z-40 bg-gray-50/50", isMobile ? "hidden" : "block")}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 py-5">
            {/* Left: Quick Actions */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
              {actions.map((action) => (
                <Link key={action.href} href={action.href} className="flex-shrink-0">
                  <button className="group flex items-center gap-2 px-3 py-2 h-10 bg-servio-purple hover:bg-white hover:border-servio-purple border-2 border-transparent transition-all duration-200 rounded-lg font-medium">
                    <action.icon className="h-4 w-4 text-white group-hover:text-servio-purple transition-colors" />
                    <span className="hidden sm:inline text-sm text-white group-hover:text-servio-purple transition-colors">
                      {action.label}
                    </span>
                  </button>
                </Link>
              ))}
            </div>

            {/* Right: Help, Support, and Venue/Role Controls */}
            <div className="flex items-center gap-2 flex-shrink-0 py-1">
              {/* Help Center Link */}
              <Link href="/help">
                <Button variant="ghost" size="sm" className="gap-2">
                  <HelpCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Help</span>
                </Button>
              </Link>

              {/* Support Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <MoreVertical className="h-4 w-4" />
                    <span className="hidden sm:inline">Support</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setSupportFormType("feature");
                      setSupportFormOpen(true);
                    }}
                  >
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Request Feature
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSupportFormType("bug");
                      setSupportFormOpen(true);
                    }}
                  >
                    <Bug className="h-4 w-4 mr-2" />
                    Report Bug
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/help" className="flex items-center w-full">
                      <HelpCircle className="h-4 w-4 mr-2" />
                      Help Center
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Support Form Modal */}
              <SupportForm
                open={supportFormOpen}
                onOpenChange={setSupportFormOpen}
                type={supportFormType}
              />

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
