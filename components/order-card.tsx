"use client";

import type { OrderWithItems as Order, OrderItem } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Clock, User, Hash, Utensils, Check, ArrowRight } from "lucide-react";

interface OrderCardProps {
  order: Order;
  onStatusUpdate: (orderId: string, status: Order["status"]) => void;
}

export default function OrderCard({ order, onStatusUpdate }: OrderCardProps) {
  const timeAgo = (date: string) => {
    const seconds = Math.floor(
      (new Date().getTime() - new Date(date).getTime()) / 1000,
    );
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
  };

  const getNextStatus = (): Order["status"] | null => {
    switch (order.status) {
      case "pending":
        return "preparing";
      case "preparing":
        return "ready";
      case "ready":
        return "completed";
      default:
        return null;
    }
  };

  const nextStatus = getNextStatus();

  return (
    <Card className="bg-white shadow-sm">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">
              Table {order.table_number}
            </CardTitle>
            <CardDescription className="flex items-center space-x-2 text-xs">
              <Hash className="h-3 w-3" />
              <span>{order.id.slice(0, 8)}</span>
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg text-servio-purple">
              £{order.total_amount.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 flex items-center justify-end space-x-1">
              <Clock className="h-3 w-3" />
              <span>{timeAgo(order.created_at)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600 pt-2">
          <User className="h-4 w-4" />
          <span>{order.customer_name}</span>
        </div>
      </CardHeader>
      <CardContent>
        <Separator />
        <ul className="space-y-2 py-3">
          {order.items && order.items.length > 0 ? (
            order.items.map((item: any, index: number) => (
              <li key={index} className="flex justify-between text-sm">
                <span>
                  {item.quantity} x {item.item_name}
                </span>
                <span>£{(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-gray-500">
              No items found for this order.
            </li>
          )}
        </ul>
        <Separator />
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        {order.status !== "cancelled" && order.status !== "completed" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onStatusUpdate(order.id, "cancelled")}
          >
            Cancel
          </Button>
        )}
        {nextStatus && (
          <Button
            size="sm"
            onClick={() => onStatusUpdate(order.id, nextStatus)}
          >
            {nextStatus === "preparing" && (
              <>
                Start Preparing <Utensils className="h-4 w-4 ml-2" />
              </>
            )}
            {nextStatus === "ready" && (
              <>
                Mark as Ready <Check className="h-4 w-4 ml-2" />
              </>
            )}
            {nextStatus === "completed" && (
              <>
                Complete Order <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
