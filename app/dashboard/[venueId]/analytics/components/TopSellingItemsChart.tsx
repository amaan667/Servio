import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";

interface TopSellingItemsChartProps {
  topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
}

export function TopSellingItemsChart({ topSellingItems }: TopSellingItemsChartProps) {
  if (topSellingItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Selling Items</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-80 flex items-center justify-center">
            <div className="text-center">
              <ShoppingBag className="h-12 w-12 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-900">No sales data available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Selling Items</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-80">
          <div className="space-y-3">
            {topSellingItems.slice(0, 8).map((item, index) => {
              const maxQuantity = Math.max(...topSellingItems.map((i) => i.quantity));
              const width = maxQuantity > 0 ? (item.quantity / maxQuantity) * 100 : 0;

              return (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-20 text-sm text-muted-foreground truncate">{item.name}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                    <div
                      className="bg-orange-500 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(width, 5)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                      {item.quantity}
                    </div>
                  </div>
                  <div className="w-16 text-sm text-muted-foreground text-right">
                    £{item.revenue.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
