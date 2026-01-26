"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Split, Clock, User, MapPin } from "lucide-react";
import { BillSplittingDialog } from "@/components/pos/BillSplittingDialog";

interface PaymentOrder {
  id: string;
  order_number?: string;
  table_number?: number | string | null;
  table_label?: string;
  counter_label?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_amount?: number;
  payment_status?: string;
  payment_method?: string;
  order_status?: string;
  created_at: string;
  items?: unknown[];
  notes?: string | null;
}

interface PayAtTillTabProps {
  orders: PaymentOrder[];
  onMarkPaid: (orderId: string) => Promise<void>;
  isProcessing: string | null;
}

export function PayAtTillTab({ orders, onMarkPaid, isProcessing }: PayAtTillTabProps) {
  const [selectedOrderForSplit, setSelectedOrderForSplit] = useState<PaymentOrder | null>(null);

  const payAtTillOrders = orders.filter((order) => {
    const method = String(order.payment_method || "").toUpperCase();
    return method === "PAY_AT_TILL";
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (payAtTillOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No orders pending payment at till</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {payAtTillOrders.map((order) => {
          const isPayLater = String(order.payment_method || "").toUpperCase() === "PAY_LATER";
          
          return (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">
                            {order.order_number || `Order ${order.id.slice(0, 8)}`}
                          </h3>
                          <Badge variant="secondary">Unpaid</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {(order.table_label || order.counter_label) && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {order.table_label || order.counter_label || `Table ${order.table_number}`}
                          </span>
                        </div>
                      )}
                      {order.customer_name && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{order.customer_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground capitalize">
                          {order.order_status?.toLowerCase().replace("_", " ") || "Unknown"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <p className="text-2xl font-bold">£{(order.total_amount || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                    <Button
                      onClick={() => onMarkPaid(order.id)}
                      disabled={isProcessing === order.id}
                      size="lg"
                      className="flex-1 border-2 font-semibold"
                    >
                      {isProcessing === order.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Mark as Paid
                        </>
                      )}
                    </Button>
                    {!isPayLater && (
                      <Button
                        onClick={() => setSelectedOrderForSplit(order)}
                        variant="outline"
                        size="lg"
                        className="flex-1 border-2 font-semibold"
                      >
                        <Split className="h-5 w-5 mr-2" />
                        Split Bill
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bill splitting handled by parent component */}
    </>
  );
}
