"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon, Clock, ShoppingBag, QrCode, BarChart, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
}

export function QuickActionsToolbar({ venueId, userRole }: QuickActionsToolbarProps) {
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
  }

  if (userRole === "owner" || userRole === "manager" || userRole === "kitchen") {
    actions.push({
      label: "Kitchen",
      href: `/dashboard/${venueId}/kds`,
      icon: ChefHat,
      description: "Kitchen display",
      color: "bg-red-600 hover:bg-red-700",
    });
  }

  return (
    <TooltipProvider>
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide">
            {actions.map((action) => (
              <Tooltip key={action.href}>
                <TooltipTrigger asChild>
                  <Link href={action.href} className="flex-shrink-0">
                    <Button
                      variant={action.variant || "outline"}
                      size="sm"
                      className={cn(
                        "gap-2 transition-all duration-200 hover:scale-105",
                        action.color || ""
                      )}
                    >
                      <action.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{action.label}</span>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{action.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
