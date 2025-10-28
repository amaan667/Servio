"use client";

import React, { useState } from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EnhancedStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  isCurrency?: boolean;
  trend?: {
    value: number;
    label: string;
  };
  subtitle?: string; // Simple subtitle without percentage
  tooltip?: string;
  onClick?: () => void;
  href?: string;
}

export function EnhancedStatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBgColor,
  isCurrency = false,
  trend,
  subtitle,
  tooltip,
  onClick,
  href,
}: EnhancedStatCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Format value for display
  const displayValue = isCurrency && typeof value === "number" ? `£${value.toFixed(2)}` : value;

  const content = (
    <Card
      className={`group relative overflow-hidden transition-all duration-300 cursor-pointer border-2 ${
        onClick || href
          ? "hover:shadow-xl hover:-translate-y-1 hover:border-gray-300"
          : "border-transparent"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Gradient overlay on hover */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-white to-gray-50/50 transition-opacity duration-300 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      />

      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`${iconBgColor} p-3 rounded-xl transition-transform duration-300 ${
              onClick || href ? "group-hover:scale-110" : ""
            }`}
          >
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>

          {trend && (
            <div
              className={`flex items-center gap-1 text-xs font-medium ${
                trend.value >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {trend.value >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{Math.round(Math.abs(trend.value))}%</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p
            className={`text-sm font-medium text-gray-600 transition-colors duration-300 ${
              onClick || href ? "group-hover:text-blue-600" : ""
            }`}
          >
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900">{displayValue}</p>
          {trend && <p className="text-xs text-gray-500">{trend.label}</p>}
          {!trend && subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>

        {/* Decorative accent bar */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${iconColor} opacity-20`}
        />
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {tooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{content}</TooltipTrigger>
              <TooltipContent>
                <p>{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          content
        )}
      </a>
    );
  }

  return tooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    content
  );
}
