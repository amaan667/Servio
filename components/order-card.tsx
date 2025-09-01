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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, User, Hash, Utensils, Check, ArrowRight } from "lucide-react";

interface OrderCardProps {
  order: Order;
  onStatusUpdate: (orderId: string, orderStatus: Order["order_status"]) => void;
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

  const getNextStatus = (): Order["order_status"] | null => {
    switch (order.order_status) {
      case "PLACED":
        return "ACCEPTED";
      case "ACCEPTED":
        return "IN_PREP";
      case "IN_PREP":
        return "READY";
      case "READY":
        return "SERVING";
      case "SERVING":
        return "COMPLETED";
      default:
        return null;
    }
  };

  const getPreviousStatus = (): Order["order_status"] | null => {
    switch (order.order_status) {
      case "ACCEPTED":
        return "PLACED";
      case "IN_PREP":
        return "ACCEPTED";
      case "READY":
        return "IN_PREP";
      case "SERVING":
        return "READY";
      case "COMPLETED":
        return "SERVING";
      default:
        return null;
    }
  };

  const nextStatus = getNextStatus();
  const previousStatus = getPreviousStatus();

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "PLACED":
        return { label: "PLACED", color: "bg-yellow-100 text-yellow-800" };
      case "ACCEPTED":
        return { label: "ACCEPTED", color: "bg-green-100 text-green-800" };
      case "IN_PREP":
        return { label: "IN PREP", color: "bg-blue-100 text-blue-800" };
      case "READY":
        return { label: "READY", color: "bg-orange-100 text-orange-800" };
      case "SERVING":
        return { label: "SERVING", color: "bg-purple-100 text-purple-800" };
      case "COMPLETED":
        return { label: "COMPLETED", color: "bg-gray-100 text-gray-800" };
      case "CANCELLED":
        return { label: "CANCELLED", color: "bg-red-100 text-red-800" };
      case "REFUNDED":
        return { label: "REFUNDED", color: "bg-red-100 text-red-800" };
      case "EXPIRED":
        return { label: "EXPIRED", color: "bg-red-100 text-red-800" };
      default:
        return { label: status.toUpperCase(), color: "bg-gray-100 text-gray-800" };
    }
  };

  const statusDisplay = getStatusDisplay(order.order_status);

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
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <User className="h-4 w-4" />
            <span>{order.customer_name}</span>
          </div>
          <Badge className={statusDisplay.color}>
            {statusDisplay.label}
          </Badge>
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
      <CardFooter className="flex justify-between">
        <div className="flex space-x-2">
          {!['CANCELLED', 'COMPLETED', 'REFUNDED', 'EXPIRED'].includes(order.order_status) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatusUpdate(order.id, "CANCELLED")}
            >
              Cancel
            </Button>
          )}
          {previousStatus && order.order_status !== "PLACED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onStatusUpdate(order.id, previousStatus)}
            >
              ← Back
            </Button>
          )}
        </div>
        <div className="flex space-x-2">
          {nextStatus && (
            <Button
              size="sm"
              onClick={() => onStatusUpdate(order.id, nextStatus)}
            >
              {nextStatus === "ACCEPTED" && (
                <>
                  Accept Order <Check className="h-4 w-4 ml-2" />
                </>
              )}
              {nextStatus === "IN_PREP" && (
                <>
                  Start Preparing <Utensils className="h-4 w-4 ml-2" />
                </>
              )}
              {nextStatus === "READY" && (
                <>
                  Mark Ready <Check className="h-4 w-4 ml-2" />
                </>
              )}
              {nextStatus === "SERVING" && (
                <>
                  Start Serving <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
              {nextStatus === "COMPLETED" && (
                <>
                  Complete <Check className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
