"use client";

import React from "react";
import { Wifi, WifiOff, Clock, CheckCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Building2, User } from "lucide-react";

interface StatusBannerProps {
  isOnline: boolean;
  isOffline: boolean;
  trialDaysLeft?: number;
  venueName?: string;
  userRole?: string;
  onVenueChange?: (venueId: string) => void;
  onRoleChange?: () => void;
}

export function StatusBanner({
  isOnline,
  isOffline,
  trialDaysLeft,
  venueName,
  userRole,
  onVenueChange: _onVenueChange,
  onRoleChange,
}: StatusBannerProps) {
  const getStatusColor = () => {
    if (isOffline) return "bg-orange-50 border-orange-200 text-orange-900";
    if (isOnline) return "bg-green-50 border-green-200 text-green-900";
    return "bg-blue-50 border-blue-200 text-blue-900";
  };

  const getStatusIcon = () => {
    if (isOffline) return <WifiOff className="h-4 w-4" />;
    if (isOnline) return <Wifi className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (isOffline) return "Connection Lost";
    if (isOnline) return "Connected";
    return "Ready";
  };

  return (
    <div
      className={`${getStatusColor()} border rounded-lg px-4 py-3 flex items-center justify-between gap-4 transition-all duration-300`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative">
          {getStatusIcon()}
          {isOnline && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{getStatusText()}</p>
          {isOffline && <p className="text-xs opacity-75">Some features may not work properly</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Trial Badge */}
        {trialDaysLeft !== undefined && trialDaysLeft > 0 && (
          <Badge variant="outline" className="bg-white/50">
            <Clock className="h-3 w-3 mr-1" />
            {trialDaysLeft} days left
          </Badge>
        )}

        {/* Venue & Role Dropdown */}
        {(venueName || userRole) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto py-1.5 px-3 gap-2">
                <Building2 className="h-4 w-4" />
                <span className="text-sm font-medium truncate max-w-[120px]">
                  {venueName || "Venue"}
                </span>
                <User className="h-3 w-3 opacity-60" />
                <span className="text-xs opacity-60">{userRole || "User"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Current Context</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Building2 className="h-4 w-4 mr-2" />
                <span className="font-medium">{venueName}</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <User className="h-4 w-4 mr-2" />
                <span>Role: {userRole}</span>
              </DropdownMenuItem>
              {onRoleChange && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onRoleChange}>
                    <Info className="h-4 w-4 mr-2" />
                    View Role Details
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
