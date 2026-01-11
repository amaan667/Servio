import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Users, Receipt } from "lucide-react";
import { PendingOrderData } from "../hooks/useOrderSummary";

interface OrderDetailsCardProps {

}

export function OrderDetailsCard({ orderData }: OrderDetailsCardProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-purple-600" />
          Order Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-600" />
          <div>
            <p className="text-sm text-gray-600">Customer Name</p>
            <p className="font-medium">{orderData.customerName}</p>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-600" />
          <div>
            <p className="text-sm text-gray-600">Order Type</p>
            <p className="font-medium capitalize">
              {orderData.orderType || (orderData.tableNumber ? "Table" : "Counter")}
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-gray-600" />
          <div>
            <p className="text-sm text-gray-600">Location</p>
            <p className="font-medium">
              {orderData.tableNumber
                ? `Table ${orderData.tableNumber}`
                : `Counter ${orderData.counterNumber}`}
            </p>
          </div>
        </div>

        {orderData.orderLocation && (
          <>
            <Separator />
            <div>
              <p className="text-sm text-gray-600">Order Location</p>
              <p className="font-medium">{orderData.orderLocation}</p>
            </div>
          </>
        )}

        {orderData.isDemo && (
          <>
            <Separator />
            <Badge variant="secondary" className="w-fit">
              Demo Order
            </Badge>
          </>
        )}
      </CardContent>
    </Card>
  );
}
