"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, QrCode, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { TableOrder } from "@/hooks/useTableOrders";
import { calculateOrderTotal, formatPrice } from "@/lib/pricing-utils";

interface TableOrderGroupCardProps {
  tableLabel: string;
  orders: TableOrder[];
  venueId: string;
}

export function TableOrderGroupCard({ tableLabel, orders, venueId }: TableOrderGroupCardProps) {
  const router = useRouter();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PLACED":
        return "bg-yellow-100 text-yellow-800";
      case "IN_PREP":
        return "bg-blue-100 text-blue-800";
      case "READY":
        return "bg-green-100 text-green-800";
      case "SERVING":
        return "bg-purple-100 text-purple-800";
      case "MIXED":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-green-100 text-green-800";
      case "UNPAID":
        return "bg-red-100 text-red-800";
      case "TILL":
        return "bg-blue-100 text-blue-800";
      case "MIXED":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTotalAmountForAllOrders = () => {
    const total = orders.reduce((sum, order) => {
      const orderTotal = calculateOrderTotal({
        total_amount: order.total_amount,
        items: order.items,
      });
      return sum + orderTotal;
    }, 0);
    return formatPrice(total);
  };

  const getOverallStatus = () => {
    const statuses = orders.map((order) => order.order_status);
    const uniqueStatuses = [...new Set(statuses)];

    if (uniqueStatuses.length === 1) {
      return uniqueStatuses[0];
    } else {
      return "MIXED";
    }
  };

  const getOverallPaymentStatus = () => {
    const paymentStatuses = orders.map((order) => order.payment_status).filter(Boolean);
    const uniquePaymentStatuses = [...new Set(paymentStatuses)];

    if (uniquePaymentStatuses.length === 1 && uniquePaymentStatuses[0]) {
      return uniquePaymentStatuses[0];
    } else {
      return "MIXED";
    }
  };

  const handleViewOrder = () => {
    // Use the first order's ID to navigate directly to that specific order
    // This ensures we find it in ANY tab (live, all, history) using the unique order ID
    if (orders.length > 0) {
      const firstOrderId = orders[0].id;
      // Navigate to Live Orders and search by order ID (last 6 chars) - will find it in any tab
      // The search functionality searches across all tabs automatically
      router.push(
        `/dashboard/${venueId}/live-orders?search=${encodeURIComponent(firstOrderId.slice(-6).toUpperCase())}&tab=all`
      );
    } else {
      // Fallback: filter by table number
      const tableNumber = tableLabel.replace(/^Table\s*/i, "").replace(/^Counter\s*/i, "");
      router.push(
        `/dashboard/${venueId}/live-orders?table=${encodeURIComponent(tableNumber)}&tab=all`
      );
    }
  };

  const overallStatus = getOverallStatus();
  const overallPaymentStatus = getOverallPaymentStatus();
  const isQrTable = orders[0]?.source !== "counter";

  return (
    <Card className="w-full border-2 border-gray-200 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md">
      <CardContent className="p-5">
        {/* Header Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-xl font-bold text-gray-900 truncate">{tableLabel}</h3>
              <Badge
                variant="secondary"
                className={`text-[11px] ${isQrTable ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}
              >
                {isQrTable ? (
                  <>
                    <QrCode className="h-3 w-3 mr-1" />
                    QR Table
                  </>
                ) : (
                  <>
                    <Receipt className="h-3 w-3 mr-1" />
                    Counter
                  </>
                )}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </p>
          </div>

          <div className="sm:text-right">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Total
            </p>
            <p className="text-2xl font-bold text-green-600 leading-none">
              £{getTotalAmountForAllOrders()}
            </p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center flex-wrap gap-2 mb-4">
          <Badge
            className={`${getStatusColor(overallStatus)} text-xs font-semibold px-3 py-1.5 rounded-full`}
          >
            {overallStatus.replace("_", " ").toLowerCase()}
          </Badge>
          <Badge
            className={`${getPaymentStatusColor(overallPaymentStatus)} text-xs font-semibold px-3 py-1.5 rounded-full`}
          >
            {overallPaymentStatus.toLowerCase()}
          </Badge>
        </div>

        {/* View Order Button */}
        <Button
          onClick={handleViewOrder}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Eye className="h-4 w-4 mr-2" />
          View Order
        </Button>
      </CardContent>
    </Card>
  );
}
