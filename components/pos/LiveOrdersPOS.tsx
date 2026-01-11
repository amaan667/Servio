"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Hash,
  CreditCard,
  Timer,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OrderItem {
  menu_item_id: string;
  quantity: number;
  price: number;
  item_name: string;
  specialInstructions?: string;
  prep_status?: "pending" | "preparing" | "ready" | "served";
  station?: "kitchen" | "bar" | "dessert";
}

interface Order {
  id: string;
  venue_id: string;
  table_number: number;
  table_id?: string;
  table_label?: string;
  source: "qr" | "counter";
  customer_name: string;
  customer_phone?: string;
  order_status: "PLACED" | "IN_PREP" | "READY" | "SERVING" | "COMPLETED" | "CANCELLED";
  payment_status: "UNPAID" | "PAID" | "TILL" | "REFUNDED";
  payment_mode: "online" | "pay_later" | "pay_at_till";
  total_amount: number;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
  prep_lead_minutes?: number;
  estimated_ready_time?: string;
}

interface LiveOrdersPOSProps {
  venueId: string;
}

const ORDER_STATUSES = {
  PLACED: { label: "Placed", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  IN_PREP: { label: "Preparing", color: "bg-blue-100 text-blue-800", icon: Play },
  READY: { label: "Ready", color: "bg-green-100 text-green-800", icon: CheckCircle },
  SERVING: { label: "Serving", color: "bg-purple-100 text-purple-800", icon: User },
  COMPLETED: { label: "Completed", color: "bg-gray-100 text-gray-800", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800", icon: XCircle },
};

const PAYMENT_STATUSES = {
  UNPAID: { label: "Unpaid", color: "bg-red-100 text-red-800", icon: AlertTriangle },
  PAID: { label: "Paid", color: "bg-green-100 text-green-800", icon: CheckCircle },
  TILL: { label: "Till", color: "bg-blue-100 text-blue-800", icon: CreditCard },
  REFUNDED: { label: "Refunded", color: "bg-orange-100 text-orange-800", icon: RefreshCw },
};

export function LiveOrdersPOS({ venueId }: LiveOrdersPOSProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [serverFilter, setServerFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("kitchen");

  useEffect(() => {
    fetchOrders();

    // Set up real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel("live-orders-pos")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pos/orders?venue_id=${venueId}&is_active=true`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch("/api/pos/orders/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          order_status: newStatus,
        }),
      });

      if (response.ok) {
        fetchOrders();
      }
    } catch (_error) {
      // Error silently handled
    }
  };

  const updateItemStatus = async (orderId: string, itemId: string, newStatus: string) => {
    try {
      const response = await fetch("/api/pos/orders/items/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          item_id: itemId,
          prep_status: newStatus,
        }),
      });

      if (response.ok) {
        fetchOrders();
      }
    } catch (_error) {
      // Error silently handled
    }
  };

  const getFilteredOrders = () => {
    return orders.filter((order) => {
      const matchesSearch =
        !searchQuery ||
        order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.table_label && order.table_label.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStation =
        stationFilter === "all" || order.items.some((item) => item.station === stationFilter);

      const matchesPayment = paymentFilter === "all" || order.payment_status === paymentFilter;

      return matchesSearch && matchesStation && matchesPayment;
    });
  };

  const getOrdersByStatus = (status: string) => {
    return getFilteredOrders().filter((order) => order.order_status === status);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins}m`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ${diffMins % 60}m`;
    }
  };

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-800";
      case "preparing":
        return "bg-blue-100 text-blue-800";
      case "ready":
        return "bg-green-100 text-green-800";
      case "served":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const OrderCard = ({ order }: { order: Order }) => {
    const StatusIcon = ORDER_STATUSES[order.order_status]?.icon || Clock;
    const PaymentIcon = PAYMENT_STATUSES[order.payment_status]?.icon || AlertTriangle;

    return (
      <Card className="mb-4 hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-gray-900" />
              <span className="font-semibold">#{order.id.slice(-6)}</span>
              <Badge className={ORDER_STATUSES[order.order_status]?.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {ORDER_STATUSES[order.order_status]?.label}
              </Badge>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-900">
                {order.source === "counter"
                  ? `Counter ${order.table_number}`
                  : order.table_label
                    ? order.table_label
                    : `Table ${order.table_number}`}
              </div>
              <div className="text-lg font-bold text-green-600">
                £{order.total_amount.toFixed(2)}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Customer Info */}
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-900" />
            <span>{order.customer_name}</span>
            {order.customer_phone && (
              <>
                <span>•</span>
                <span>{order.customer_phone}</span>
              </>
            )}
          </div>

          {/* Time Info */}
          <div className="flex items-center gap-4 text-sm text-gray-900">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Placed: {formatTime(order.created_at)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Timer className="h-4 w-4" />
              <span>Wait: {getTimeSince(order.created_at)}</span>
            </div>
          </div>

          {/* Payment Status */}
          <div className="flex items-center gap-2">
            <Badge className={PAYMENT_STATUSES[order.payment_status]?.color}>
              <PaymentIcon className="h-3 w-3 mr-1" />
              {PAYMENT_STATUSES[order.payment_status]?.label}
            </Badge>
            {order.payment_mode !== "online" && (
              <Badge variant="outline" className="text-xs">
                {order.payment_mode.replace("_", " ")}
              </Badge>
            )}
          </div>

          {/* Order Items */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Items:</h4>
            {order.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {item.quantity}x {item.item_name}
                    </span>
                    {item.station && (
                      <Badge variant="outline" className="text-xs">
                        {item.station}
                      </Badge>
                    )}
                  </div>
                  {item.specialInstructions && (
                    <p className="text-xs text-orange-600 mt-1">Note: {item.specialInstructions}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    £{(item.price * item.quantity).toFixed(2)}
                  </span>
                  {item.prep_status && (
                    <Badge className={getItemStatusColor(item.prep_status)}>
                      {item.prep_status}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Order Notes */}
          {order.notes && (
            <div className="p-2 bg-yellow-50 rounded border-l-4 border-yellow-400">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Order Notes:</span> {order.notes}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {order.order_status === "PLACED" && (
              <Button
                size="sm"
                onClick={() => updateOrderStatus(order.id, "IN_PREP")}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-1" />
                Start Prep
              </Button>
            )}
            {order.order_status === "IN_PREP" && (
              <Button
                size="sm"
                onClick={() => updateOrderStatus(order.id, "READY")}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {order.source === "counter" ? "Mark as Ready for Pickup" : "Mark as Served"}
              </Button>
            )}
            {order.order_status === "READY" && (
              <Button
                size="sm"
                onClick={() => updateOrderStatus(order.id, "COMPLETED")}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Complete Order
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading orders...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-700" />
          <Input
            placeholder="Search orders, customers, tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={stationFilter} onValueChange={setStationFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Station" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stations</SelectItem>
            <SelectItem value="kitchen">Kitchen</SelectItem>
            <SelectItem value="bar">Bar</SelectItem>
            <SelectItem value="dessert">Dessert</SelectItem>
          </SelectContent>
        </Select>

        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payment</SelectItem>
            <SelectItem value="UNPAID">Unpaid</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="TILL">Till</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={fetchOrders}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Station Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="kitchen">Kitchen</TabsTrigger>
          <TabsTrigger value="bar">Bar</TabsTrigger>
          <TabsTrigger value="dessert">Dessert</TabsTrigger>
          <TabsTrigger value="all">All Stations</TabsTrigger>
        </TabsList>

        <TabsContent value="kitchen" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Pipeline Columns */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-yellow-800">
                Placed ({getOrdersByStatus("PLACED").length})
              </h3>
              <div className="space-y-4">
                {getOrdersByStatus("PLACED").map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-blue-800">
                Preparing ({getOrdersByStatus("IN_PREP").length})
              </h3>
              <div className="space-y-4">
                {getOrdersByStatus("IN_PREP").map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-green-800">
                Ready ({getOrdersByStatus("READY").length})
              </h3>
              <div className="space-y-4">
                {getOrdersByStatus("READY").map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-purple-800">
                Serving ({getOrdersByStatus("SERVING").length})
              </h3>
              <div className="space-y-4">
                {getOrdersByStatus("SERVING").map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bar" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Same pipeline for bar items */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-yellow-800">
                Placed ({getOrdersByStatus("PLACED").length})
              </h3>
              <div className="space-y-4">
                {getOrdersByStatus("PLACED").map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>
            {/* ... other columns */}
          </div>
        </TabsContent>

        <TabsContent value="dessert" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Same pipeline for dessert items */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-yellow-800">
                Placed ({getOrdersByStatus("PLACED").length})
              </h3>
              <div className="space-y-4">
                {getOrdersByStatus("PLACED").map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>
            {/* ... other columns */}
          </div>
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* All stations combined view */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-yellow-800">
                Placed ({getOrdersByStatus("PLACED").length})
              </h3>
              <div className="space-y-4">
                {getOrdersByStatus("PLACED").map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>
            {/* ... other columns */}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
