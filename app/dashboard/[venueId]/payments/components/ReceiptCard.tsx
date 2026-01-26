"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, Download, CheckCircle, Split, Clock, User, MapPin } from "lucide-react";

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

interface ReceiptCardProps {
  order: PaymentOrder;
  onViewReceipt: (order: PaymentOrder) => void;
  onSplitBill?: (order: PaymentOrder) => void;
  showSplitButton?: boolean;
}

export function ReceiptCard({ order, onViewReceipt, onSplitBill, showSplitButton = false }: ReceiptCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status?: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      PAID: { label: "Paid", variant: "default" },
      UNPAID: { label: "Unpaid", variant: "secondary" },
      REFUNDED: { label: "Refunded", variant: "destructive" },
    };
    const statusInfo = statusMap[status || ""] || { label: status || "Unknown", variant: "outline" as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg">
                    {order.order_number || `Order ${order.id.slice(0, 8)}`}
                  </h3>
                  {getStatusBadge(order.payment_status)}
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
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground capitalize">
                  {order.payment_method?.toLowerCase().replace("_", " ") || "Unknown"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-2xl font-bold">£{(order.total_amount || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
            <Button variant="outline" size="sm" onClick={() => onViewReceipt(order)} className="gap-2">
              <Receipt className="h-4 w-4" />
              Receipt
            </Button>
            {showSplitButton && onSplitBill && (
              <Button variant="outline" size="sm" onClick={() => onSplitBill(order)} className="gap-2">
                <Split className="h-4 w-4" />
                Split
              </Button>
            )}
            <Button variant="outline" size="sm" asChild className="gap-2">
              <a
                href={`/api/receipts/pdf/${order.id}`}
                target="_blank"
                rel="noopener noreferrer"
                download
              >
                <Download className="h-4 w-4" />
                PDF
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
