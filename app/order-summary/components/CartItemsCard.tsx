import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart } from "lucide-react";
import { PendingOrderData } from "../hooks/useOrderSummary";

interface CartItemsCardProps {
  orderData: PendingOrderData;
}

export function CartItemsCard({ orderData }: CartItemsCardProps) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-purple-600" />
          Your Order
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {orderData.cart.map((item, index) => (
          <div key={index}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                {item.specialInstructions && (
                  <p className="text-sm text-gray-600 mt-1">Note: {item.specialInstructions}</p>
                )}
              </div>
              <div className="text-right ml-4">
                <p className="font-medium">£{(item.price * item.quantity).toFixed(2)}</p>
                <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
              </div>
            </div>
            {index < orderData.cart.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}

        <Separator className="my-4" />

        <div className="flex justify-between items-center">
          <p className="text-lg font-semibold">Total</p>
          <p className="text-xl font-bold text-purple-600">£{orderData.total.toFixed(2)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
