import { CheckCircle, RefreshCw, XCircle } from "lucide-react";

export const TABLE_ORDER_STATUSES = [
  {
    key: "PLACED",
    label: "Order Placed",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Order has been placed.",
  },
  {
    key: "ACCEPTED",
    label: "Order Accepted",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Your order has been accepted by the kitchen.",
  },
  {
    key: "IN_PREP",
    label: "In Preparation",
    icon: RefreshCw,
    color: "bg-orange-100 text-orange-800",
    description: "Your order is being prepared in the kitchen.",
  },
  {
    key: "READY",
    label: "Ready for Pickup / Serving",
    icon: CheckCircle,
    color: "bg-blue-100 text-blue-800",
    description: "Your order is ready for pickup / serving.",
  },
  {
    key: "SERVING",
    label: "Being Served",
    icon: CheckCircle,
    color: "bg-purple-100 text-purple-800",
    description: "Your order has been served. Enjoy your meal!",
  },
  {
    key: "COMPLETED",
    label: "Completed",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Thank you for your order!",
  },
];

export const COUNTER_ORDER_STATUSES = [
  {
    key: "PLACED",
    label: "Order Placed",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Order has been placed.",
  },
  {
    key: "ACCEPTED",
    label: "Order Accepted",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Your order has been accepted by the kitchen.",
  },
  {
    key: "IN_PREP",
    label: "In Preparation",
    icon: RefreshCw,
    color: "bg-orange-100 text-orange-800",
    description: "Your order is being prepared in the kitchen.",
  },
  {
    key: "READY",
    label: "Ready for Pickup",
    icon: CheckCircle,
    color: "bg-blue-100 text-blue-800",
    description: "Your order is ready for pickup at the counter.",
  },
  {
    key: "COMPLETED",
    label: "Completed",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Thank you for your order!",
  },
];

// Table Pickup: Customer sits at table but collects food at counter
// Combines table seating with counter collection
export const TABLE_PICKUP_ORDER_STATUSES = [
  {
    key: "PLACED",
    label: "Order Placed",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Order has been placed from your table.",
  },
  {
    key: "ACCEPTED",
    label: "Order Accepted",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Your order has been accepted by the kitchen.",
  },
  {
    key: "IN_PREP",
    label: "In Preparation",
    icon: RefreshCw,
    color: "bg-orange-100 text-orange-800",
    description: "Your order is being prepared in the kitchen.",
  },
  {
    key: "READY",
    label: "Ready for Collection",
    icon: CheckCircle,
    color: "bg-blue-100 text-blue-800",
    description: "Your order is ready! Please collect at the counter.",
  },
  {
    key: "COMPLETED",
    label: "Completed",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800",
    description: "Thank you for your order! Enjoy your meal at your table.",
  },
];

export const GREYED_OUT_STATUSES = [
  {
    key: "CANCELLED",
    label: "Order Cancelled",
    icon: XCircle,
    color: "bg-red-100 text-red-800",
    description: "Your order has been cancelled",
  },
  {
    key: "REFUNDED",
    label: "Order Refunded",
    icon: XCircle,
    color: "bg-red-100 text-red-800",
    description: "Your order has been refunded",
  },
  {
    key: "EXPIRED",
    label: "Order Expired",
    icon: XCircle,
    color: "bg-gray-100 text-gray-800",
    description: "Your order has expired",
  },
];
