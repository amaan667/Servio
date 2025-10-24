"use client";

import React from 'react';
import { Sparkles, TrendingUp, TrendingDown, AlertCircle, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

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
  topSellingItems?: Array<{ name: string; price: number; count: number }>;
  yesterdayComparison?: {
    orders: number;
    revenue: number;
  };
}

export function AIInsights({ venueId, stats, topSellingItems, yesterdayComparison }: AIInsightsProps) {
  const insights: Insight[] = [];

  // Generate insights based on data
  // Only show "No Orders Yet" if BOTH order count is 0 AND revenue is 0 (double check)
  // AND there are no top selling items (triple check)
  const hasRealOrders = stats.revenue > 0 || (topSellingItems && topSellingItems.length > 0);
  
  if (stats.todayOrdersCount === 0 && !hasRealOrders) {
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

  // Top selling item insight
  if (topSellingItems && topSellingItems.length > 0) {
    const topItem = topSellingItems[0];
    insights.push({
      type: 'success',
      title: 'Top Seller',
      message: `"${topItem.name}" (£${topItem.price.toFixed(2)}) is your best-selling item with ${topItem.count} orders today. Consider promoting it!`,
      action: {
        label: 'Edit Menu',
        href: `/dashboard/${venueId}/menu-management`
      }
    });
  }

  // Yesterday comparison insights
  if (yesterdayComparison) {
    const orderChange = ((stats.todayOrdersCount - yesterdayComparison.orders) / (yesterdayComparison.orders || 1)) * 100;
    const revenueChange = ((stats.revenue - yesterdayComparison.revenue) / (yesterdayComparison.revenue || 1)) * 100;

    if (orderChange > 20) {
      insights.push({
        type: 'success',
        title: 'Strong Growth',
        message: `Orders are up ${orderChange.toFixed(0)}% compared to yesterday! Keep up the momentum.`,
        action: {
          label: 'View Analytics',
          href: `/dashboard/${venueId}/analytics`
        }
      });
    } else if (orderChange < -20) {
      insights.push({
        type: 'warning',
        title: 'Orders Down',
        message: `Orders are down ${Math.abs(orderChange).toFixed(0)}% compared to yesterday. Consider promotions or check your QR codes.`,
        action: {
          label: 'View QR Codes',
          href: `/dashboard/${venueId}/qr-codes`
        }
      });
    }

    if (revenueChange > 15) {
      insights.push({
        type: 'success',
        title: 'Revenue Boost',
        message: `Revenue is up ${revenueChange.toFixed(0)}% compared to yesterday. Excellent work!`,
        action: {
          label: 'View Analytics',
          href: `/dashboard/${venueId}/analytics`
        }
      });
    }
  }

  // Average order value insight
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
    } else if (avgOrderValue > 20) {
      insights.push({
        type: 'success',
        title: 'High Order Value',
        message: `Your average order value of £${avgOrderValue.toFixed(2)} is excellent! Your customers are spending well.`,
      });
    }
  }

  // Menu items insight
  if (stats.menuItems < 5) {
    insights.push({
      type: 'info',
      title: 'Expand Your Menu',
      message: `You have ${stats.menuItems} items on your menu. Consider adding more variety to attract more customers.`,
      action: {
        label: 'Add Menu Items',
        href: `/dashboard/${venueId}/menu-management`
      }
    });
  }

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-bold text-gray-900">AI Insights</h3>
      </div>
      {insights.slice(0, 3).map((insight, index) => (
        <Card 
          key={index} 
          className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all duration-200 animate-in fade-in"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg flex-shrink-0 ${
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-semibold text-sm text-gray-900">{insight.title}</h4>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Brain className="h-3 w-3" />
                    AI Insight
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{insight.message}</p>
                
                {insight.action && (
                  <Link 
                    href={insight.action.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 mt-2 transition-colors"
                  >
                    {insight.action.label}
                    <span>→</span>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {insights.length > 3 && (
        <div className="text-center pt-2">
          <Link 
            href={`/dashboard/${venueId}/analytics`}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            View More Insights
            <span>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
