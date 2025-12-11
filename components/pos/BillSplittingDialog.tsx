"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Split, Plus, Minus, DollarSign, Users, CreditCard, CheckCircle } from "lucide-react";

interface Order {
  id: string;
  customer_name: string;
  total_amount: number;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    price: number;
    item_name: string;
    specialInstructions?: string;
  }>;
}

interface BillSplit {
  id: string;
  orders: string[];
  total_amount: number;
  payment_status: "UNPAID" | "PAID";
  payment_method?: string;
}

interface BillSplittingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  tableSessionId?: string;
  counterSessionId?: string;
  venueId: string;
  onSplitComplete: () => void;
}

export function BillSplittingDialog({
  isOpen,
  onClose,
  orders,
  tableSessionId,
  counterSessionId,
  venueId,
  onSplitComplete,
}: BillSplittingDialogProps) {
  const [splits, setSplits] = useState<BillSplit[]>([]);
  const [splitCount, setSplitCount] = useState(2);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && orders.length > 0) {
      initializeSplits();
    }
  }, [isOpen, orders, splitCount]);

  const initializeSplits = () => {
    const totalAmount = orders.reduce((sum, order) => sum + order.total_amount, 0);
    const amountPerSplit = totalAmount / splitCount;

    const newSplits: BillSplit[] = [];
    for (let i = 0; i < splitCount; i++) {
      newSplits.push({
        id: `split-${i + 1}`,
        orders: [],
        total_amount: 0,
        payment_status: "UNPAID",
      });
    }

    setSplits(newSplits);
  };

  const addOrderToSplit = (orderId: string, splitId: string) => {
    setSplits((prev) =>
      prev.map((split) => {
        if (split.id === splitId) {
          const newOrders = [...split.orders, orderId];
          const order = orders.find((o) => o.id === orderId);
          const newTotal = newOrders.reduce((sum, id) => {
            const order = orders.find((o) => o.id === id);
            return sum + (order?.total_amount || 0);
          }, 0);

          return {
            ...split,
            orders: newOrders,
            total_amount: newTotal,
          };
        }
        return split;
      })
    );
  };

  const removeOrderFromSplit = (orderId: string, splitId: string) => {
    setSplits((prev) =>
      prev.map((split) => {
        if (split.id === splitId) {
          const newOrders = split.orders.filter((id) => id !== orderId);
          const newTotal = newOrders.reduce((sum, id) => {
            const order = orders.find((o) => o.id === id);
            return sum + (order?.total_amount || 0);
          }, 0);

          return {
            ...split,
            orders: newOrders,
            total_amount: newTotal,
          };
        }
        return split;
      })
    );
  };

  const getAvailableOrders = () => {
    const usedOrderIds = splits.flatMap((split) => split.orders);
    return orders.filter((order) => !usedOrderIds.includes(order.id));
  };

  const getSplitForOrder = (orderId: string) => {
    return splits.find((split) => split.orders.includes(orderId));
  };

  const handleCreateSplits = async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/pos/bill-splits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_id: venueId,
          table_session_id: tableSessionId,
          counter_session_id: counterSessionId,
          action: "create_splits",
          splits: splits.map((split) => ({
            total_amount: split.total_amount,
            order_ids: split.orders,
          })),
        }),
      });

      if (response.ok) {
        onSplitComplete();
        onClose();
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const splitTotal = splits.reduce((sum, split) => sum + split.total_amount, 0);
  const remainingAmount = totalAmount - splitTotal;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5" />
            Split Bill
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Split Count Control */}
          <div className="flex items-center gap-4">
            <Label htmlFor="splitCount">Number of Splits:</Label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSplitCount(Math.max(2, splitCount - 1))}
                disabled={splitCount <= 2}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center">{splitCount}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSplitCount(Math.min(orders.length, splitCount + 1))}
                disabled={splitCount >= orders.length}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Total Amount Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bill Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span>Total Amount:</span>
                <span className="text-xl font-bold">£{totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Split Total:</span>
                <span className="text-lg">£{splitTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Remaining:</span>
                <span
                  className={`text-lg ${remainingAmount === 0 ? "text-green-600" : "text-red-600"}`}
                >
                  £{remainingAmount.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Available Orders */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Available Orders</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {getAvailableOrders().map((order) => (
                <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{order.customer_name}</h4>
                        <p className="text-sm text-gray-900">Order #{order.id.slice(-6)}</p>
                      </div>
                      <span className="font-semibold">£{order.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-gray-900 mb-3">
                      {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                    </div>
                    <div className="flex gap-2">
                      {splits.map((split) => (
                        <Button
                          key={split.id}
                          size="sm"
                          variant="outline"
                          onClick={() => addOrderToSplit(order.id, split.id)}
                          className="flex-1"
                        >
                          Add to {split.id.replace("split-", "Split ")}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Bill Splits */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Bill Splits</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {splits.map((split) => (
                <Card key={split.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{split.id.replace("split-", "Split ")}</span>
                      <Badge variant="outline">£{split.total_amount.toFixed(2)}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {split.orders.map((orderId) => {
                        const order = orders.find((o) => o.id === orderId);
                        if (!order) return null;

                        return (
                          <div
                            key={orderId}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded"
                          >
                            <div>
                              <p className="font-medium">{order.customer_name}</p>
                              <p className="text-sm text-gray-900">#{order.id.slice(-6)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                £{order.total_amount.toFixed(2)}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeOrderFromSplit(orderId, split.id)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                      {split.orders.length === 0 && (
                        <p className="text-gray-900 text-center py-4">
                          No orders assigned to this split
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateSplits}
            disabled={loading || remainingAmount !== 0}
            className="flex items-center gap-2"
          >
            <Split className="h-4 w-4" />
            {loading ? "Creating Splits..." : "Create Bill Splits"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
