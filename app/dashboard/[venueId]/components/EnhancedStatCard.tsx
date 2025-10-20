"use client";

import React, { useState } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EnhancedStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  trend?: {
    value: number;
    label: string;
  };
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
  trend,
  tooltip,
  onClick,
  href
}: EnhancedStatCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const content = (
    <Card 
      className={`relative overflow-hidden transition-all duration-300 cursor-pointer ${
        onClick || href ? 'hover:shadow-xl hover:-translate-y-1' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Gradient overlay on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br from-white to-gray-50/50 transition-opacity duration-300 ${
        isHovered ? 'opacity-100' : 'opacity-0'
      }`} />
      
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`${iconBgColor} p-3 rounded-xl`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
          
          {trend && (
            <div className={`flex items-center gap-1 text-xs font-medium ${
              trend.value >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend.value >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className="text-xs text-gray-500">{trend.label}</p>
          )}
        </div>

        {/* Decorative accent bar */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${iconColor} opacity-20`} />
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {tooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {content}
              </TooltipTrigger>
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
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    content
  );
}

