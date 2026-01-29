"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Undo2 } from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface PaymentOrder {
  id: string;
  order_number?: string;
  customer_name?: string | null;
  total_amount?: number;
  payment_status?: string;
  payment_method?: string;
  created_at: string;
}

interface RefundDialogProps {
  onRefundProcessed: () => void;
}

const refundReasons = [
  "Customer request",
  "Order error",
  "Food quality",
  "Wrong item",
  "Late delivery",
  "Double charge",
  "System error",
  "Other",
];

export function RefundDialog({ onRefundProcessed }: RefundDialogProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<PaymentOrder | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const loadPaidOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("payment_status", "PAID")
        .in("payment_method", ["PAY_NOW", "PAY_AT_TILL", "PAY_LATER"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setOrders(data as PaymentOrder[]);
      }
    } catch (error) {
      // Error loading orders - handled silently
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPaidOrders();
    }
  }, [isOpen]);

  const filteredOrders = orders.filter(
    (order) =>
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const processRefund = async () => {
    if (!selectedOrder || !refundAmount || !refundReason) {
      toast({
        title: "Missing Information",
        description: "Please select an order, enter refund amount, and select a reason.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const amount = parseFloat(refundAmount);
      if (isNaN(amount) || amount <= 0 || amount > (selectedOrder.total_amount || 0)) {
        toast({
          title: "Invalid Amount",
          description: "Refund amount must be a positive number not exceeding the order total.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const reason = refundReason === "Other" ? customReason : refundReason;
      if (!reason) {
        toast({
          title: "Reason Required",
          description: "Please provide a refund reason.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const { error } = await supabase.from("refunds").insert({
        order_id: selectedOrder.id,
        refund_amount: amount,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
        status: "PROCESSED",
      });

      if (error) throw error;

      toast({
        title: "Refund Processed",
        description: `Refund of £${amount.toFixed(2)} has been processed for order ${selectedOrder.order_number || selectedOrder.id}.`,
      });

      setSelectedOrder(null);
      setRefundAmount("");
      setRefundReason("");
      setCustomReason("");
      setIsOpen(false);
      onRefundProcessed();
    } catch (error) {
      toast({
        title: "Refund Failed",
        description:
          error instanceof Error ? error.message : "Failed to process refund. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Undo2 className="h-4 w-4" />
          Process Refund
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Order Search */}
          <div>
            <Label>Search Orders</Label>
            <Input
              placeholder="Search by order number, customer name, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Order List */}
          <div className="max-h-60 overflow-y-auto border rounded-md">
            {filteredOrders.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No orders found</div>
            ) : (
              <div className="divide-y">
                {filteredOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => {
                      setSelectedOrder(order);
                      setRefundAmount(String(order.total_amount || 0));
                    }}
                    className={`w-full p-3 text-left hover:bg-muted transition-colors ${
                      selectedOrder?.id === order.id ? "bg-muted border-l-4 border-primary" : ""
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {order.order_number || order.id.slice(0, 8)}
                          {order.customer_name && ` - ${order.customer_name}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          £{(order.total_amount || 0).toFixed(2)} •{" "}
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refund Details */}
          {selectedOrder && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label>Refund Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedOrder.total_amount || 0}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum: £{(selectedOrder.total_amount || 0).toFixed(2)}
                </p>
              </div>

              <div>
                <Label>Refund Reason</Label>
                <Select value={refundReason} onValueChange={setRefundReason}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {refundReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {refundReason === "Other" && (
                <div>
                  <Label>Custom Reason</Label>
                  <Textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Please provide details..."
                    className="mt-1"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={processRefund} disabled={isProcessing} className="flex-1">
                  {isProcessing ? "Processing..." : "Process Refund"}
                </Button>
                <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
