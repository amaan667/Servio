"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCsvDownload } from "@/hooks/useCsvDownload";

// Hooks
import { useAnalyticsData, TimePeriod } from "./hooks/useAnalyticsData";

// Components
import { StatCard } from "./components/StatCard";
import { RevenueChart } from "./components/RevenueChart";
import { TopSellingItemsChart } from "./components/TopSellingItemsChart";
import { TimePeriodSelector } from "./components/TimePeriodSelector";

// Utils
import { prepareCSVData, generateCSV, getCSVFilename } from "./utils/csvExport";
import { Clock, DollarSign, ShoppingBag } from "lucide-react";

/**
 * Analytics Client Component
 * Displays venue analytics including revenue, orders, and top-selling items
 *
 * Refactored: Extracted hooks, components, and utilities for better organization
 * Original: 868 lines → Now: ~150 lines
 */

export default function AnalyticsClient({
  venueId,
  venueName: _venueName,
}: {
  venueId: string;
  venueName: string;
}) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("30d");
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(
    null
  );

  const { loading, error, analyticsData, filteredOrders, refetch } = useAnalyticsData(
    venueId,
    timePeriod,
    customDateRange
  );
  const { toast } = useToast();
  const { downloadCSV, isDownloading } = useCsvDownload();

  const handleExportCSV = useCallback(() => {
    if (filteredOrders.length === 0) {
      toast({
        title: "No Data to Export",
        description: "No data to export for the selected date range.",
        variant: "default",
      });
      return;
    }

    try {
      const csvRows = prepareCSVData(filteredOrders);
      const csv = generateCSV(csvRows);
      const filename = getCSVFilename();

      downloadCSV({ filename, csv });

      toast({
        title: "CSV Downloaded",
        description: `Analytics data exported successfully (${csvRows.length} rows).`,
        variant: "default",
      });
    } catch (_error) {
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data. Please try again.",
        variant: "destructive",
      });
    }
  }, [filteredOrders, downloadCSV, toast]);

  // Removed loading check - render immediately with empty state

  return (
    <div className="space-y-6">
      {/* Time Period Selector */}
      <TimePeriodSelector
        timePeriod={timePeriod}
        onTimePeriodChange={setTimePeriod}
        customDateRange={customDateRange}
        onCustomDateRangeChange={setCustomDateRange}
        onExportCSV={handleExportCSV}
        isDownloading={isDownloading}
        hasData={filteredOrders.length > 0}
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Orders"
          value={analyticsData.totalOrders}
          icon={Clock}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
        />
        <StatCard
          title="Total Revenue"
          value={`£${analyticsData.totalRevenue.toFixed(2)}`}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <StatCard
          title="Average Order"
          value={`£${analyticsData.averageOrderValue.toFixed(2)}`}
          icon={BarChart}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
        />
        <StatCard
          title="Menu Items"
          value={analyticsData.menuItemsCount}
          icon={ShoppingBag}
          iconColor="text-orange-600"
          iconBgColor="bg-orange-100"
        />
      </div>

      {/* Enhanced Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <RevenueChart
          revenueOverTime={analyticsData.revenueOverTime}
          trendline={analyticsData.trendline}
          peakDay={analyticsData.peakDay}
          lowestDay={analyticsData.lowestDay}
          timePeriod={timePeriod}
        />
        <TopSellingItemsChart topSellingItems={analyticsData.topSellingItems} />
      </div>

      {/* No Data State */}
      {analyticsData.totalOrders === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <BarChart className="h-16 w-16 text-gray-700 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Analytics Data Yet</h3>
            <p className="text-gray-900 mb-6 max-w-md mx-auto">
              Analytics will appear here once you start receiving orders. Generate QR codes and
              start taking orders to see your business insights.
            </p>
            <div className="flex justify-center space-x-4">
              <Button asChild>
                <Link href={`/dashboard/${venueId}/qr-codes`}>Generate QR Codes</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/dashboard/${venueId}/live-orders`}>View Live Orders</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
