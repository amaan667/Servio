"use client";

import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Insight {
  type: 'success' | 'warning' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
}

interface AIInsightsProps {
  venueId: string;
  stats: {
    revenue: number;
    menuItems: number;
    todayOrdersCount: number;
  };
  topSellingItem?: {
    name: string;
    price: number;
  };
}

export function AIInsights({ venueId, stats, topSellingItem }: AIInsightsProps) {
  const insights: Insight[] = [];

  // Generate insights based on data
  if (stats.todayOrdersCount === 0) {
    insights.push({
      type: 'warning',
      title: 'No Orders Yet Today',
      message: 'Consider testing your QR flow or promoting your menu to customers.',
      action: {
        label: 'View QR Codes',
        href: `/dashboard/${venueId}/qr-codes`
      }
    });
  }

  if (topSellingItem) {
    insights.push({
      type: 'success',
      title: 'Top Seller',
      message: `"${topSellingItem.name}" (£${topSellingItem.price.toFixed(2)}) is your best-selling item. Consider promoting it!`,
      action: {
        label: 'Edit Menu',
        href: `/dashboard/${venueId}/menu-management`
      }
    });
  }

  if (stats.revenue > 0 && stats.todayOrdersCount > 0) {
    const avgOrderValue = stats.revenue / stats.todayOrdersCount;
    if (avgOrderValue < 10) {
      insights.push({
        type: 'info',
        title: 'Average Order Value',
        message: `Your average order is £${avgOrderValue.toFixed(2)}. Consider upselling or adding combo deals to increase revenue.`,
        action: {
          label: 'View Analytics',
          href: `/dashboard/${venueId}/analytics`
        }
      });
    }
  }

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => (
        <Card key={index} className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                insight.type === 'success' ? 'bg-green-100' :
                insight.type === 'warning' ? 'bg-orange-100' :
                'bg-blue-100'
              }`}>
                {insight.type === 'success' ? (
                  <TrendingUp className={`h-4 w-4 ${
                    insight.type === 'success' ? 'text-green-600' :
                    insight.type === 'warning' ? 'text-orange-600' :
                    'text-blue-600'
                  }`} />
                ) : insight.type === 'warning' ? (
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                ) : (
                  <Sparkles className="h-4 w-4 text-blue-600" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm text-gray-900">{insight.title}</h4>
                  <Badge variant="outline" className="text-xs">
                    AI Insight
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{insight.message}</p>
                
                {insight.action && (
                  <a 
                    href={insight.action.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 mt-2"
                  >
                    {insight.action.label}
                    <span>→</span>
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

