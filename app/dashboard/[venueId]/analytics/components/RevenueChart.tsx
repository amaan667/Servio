import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";
import { formatTooltipDate, formatXAxisLabel, getTimePeriodLabel } from "../utils/dateFormatters";
import { TimePeriod } from "../hooks/useAnalyticsData";

interface RevenueChartProps {
  revenueOverTime: Array<{
    date: string;
    revenue: number;
    orders: number;
    isCurrentPeriod?: boolean;
    isPeak?: boolean;
    isLowest?: boolean;
  }>;
  trendline: number;
  peakDay: { date: string; revenue: number };
  lowestDay: { date: string; revenue: number };
  timePeriod: TimePeriod;
}

export function RevenueChart({
  revenueOverTime,
  trendline,
  peakDay,
  lowestDay: _lowestDay,
  timePeriod,
}: RevenueChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  if (revenueOverTime.length === 0) {
    return (
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Revenue & Orders Over Time - {getTimePeriodLabel(timePeriod)}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-900">No revenue data available</p>
              <p className="text-sm text-gray-700 mt-1">Try selecting a different time period</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-base sm:text-lg">
            Revenue & Orders Over Time - {getTimePeriodLabel(timePeriod)}
          </CardTitle>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm">
            {peakDay.revenue > 0 && (
              <div className="flex items-center space-x-1 text-green-600">
                <Award className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Best: £{peakDay.revenue.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-80">
          <div className="h-full relative">
            {/* Trendline */}
            {trendline > 0 && (
              <div
                className="absolute w-full border-t-2 border-dashed border-gray-300 opacity-50"
                style={{
                  bottom: `${(trendline / Math.max(...revenueOverTime.map((d) => d.revenue))) * 100}%`,
                }}
              />
            )}

            {/* Chart Bars and Lines */}
            <div className="h-64 flex items-end justify-between space-x-1 relative">
              {revenueOverTime.map((period, index) => {
                const maxRevenue = Math.max(...revenueOverTime.map((d) => d.revenue));
                const maxOrders = Math.max(...revenueOverTime.map((d) => d.orders));

                const revenueHeight = maxRevenue > 0 ? (period.revenue / maxRevenue) * 100 : 0;
                const ordersHeight = maxOrders > 0 ? (period.orders / maxOrders) * 100 : 0;

                const isHovered = hoveredPoint === index;
                const barColor = period.isPeak
                  ? "bg-green-500"
                  : period.isCurrentPeriod
                    ? "bg-purple-600"
                    : "bg-purple-500";

                return (
                  <div
                    key={index}
                    className="flex flex-col items-center flex-1 group cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(index)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Order Count Bars (background) */}
                    <div
                      className="w-full bg-blue-200 rounded-t transition-all duration-300"
                      style={{
                        height: `${Math.max(ordersHeight * 0.6, 2)}%`,
                        minHeight: period.orders > 0 ? "8px" : "2px",
                      }}
                    />

                    {/* Revenue Bars (foreground) */}
                    <div
                      className={`w-full ${barColor} rounded-t transition-all duration-300 ${isHovered ? "ring-2 ring-purple-300" : ""}`}
                      style={{
                        height: `${Math.max(revenueHeight, 2)}%`,
                        minHeight: period.revenue > 0 ? "12px" : "4px",
                      }}
                    />

                    {/* Removed Peak/Lowest badges from chart bars */}
                  </div>
                );
              })}
            </div>

            {/* X-axis Labels - Fixed positioning */}
            <div className="h-12 flex items-start justify-between space-x-1 mt-2 pt-1">
              {revenueOverTime.map((period, index) => {
                const label = formatXAxisLabel(
                  period.date,
                  timePeriod,
                  index,
                  revenueOverTime.length
                );
                if (!label) return <div key={index} className="flex-1" />;

                return (
                  <div key={index} className="flex-1 text-center">
                    <span className="text-xs text-muted-foreground break-words leading-tight">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Hover Tooltip */}
            {hoveredPoint !== null && (
              <div className="absolute top-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10">
                <div className="text-sm font-medium text-gray-900">
                  {formatTooltipDate(revenueOverTime[hoveredPoint]?.date, timePeriod)}
                </div>
                <div className="text-sm text-gray-900 mt-1">
                  Revenue: £{revenueOverTime[hoveredPoint]?.revenue.toFixed(2)}
                </div>
                <div className="text-sm text-gray-900">
                  Orders: {revenueOverTime[hoveredPoint]?.orders}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart Legend */}
        <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span className="text-muted-foreground">Revenue</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-200 rounded"></div>
            <span className="text-muted-foreground">Orders</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-1 bg-gray-300 border-dashed border-t-2"></div>
            <span className="text-muted-foreground">Average</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
