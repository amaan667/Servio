"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Clock,
  CreditCard,
  Receipt,
  Table,
  CheckCircle,
  AlertTriangle,
  Plus,
  Timer,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

interface TableEntity {

  payment_mode_mix: Record<string, number>;

}

interface CounterEntity {

}

interface TableManagementEntityProps {

}

export function TableManagementEntity({ venueId }: TableManagementEntityProps) {
  const [tables, setTables] = useState<TableEntity[]>([]);
  const [counters, setCounters] = useState<CounterEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSeatDialog, setShowSeatDialog] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableEntity | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [serverId, setServerId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchEntities();
  }, [venueId]);

  const fetchEntities = async () => {
    try {
      setLoading(true);

      // Fetch tables and counters in parallel
      const [tablesResponse, countersResponse] = await Promise.all([
        fetch(`/api/pos/table-sessions?venue_id=${venueId}`),
        fetch(`/api/pos/counter-sessions?venue_id=${venueId}`),
      ]);

      if (tablesResponse.ok) {
        const tablesData = await tablesResponse.json();
        setTables(tablesData.tables || []);
      }

      if (countersResponse.ok) {
        const countersData = await countersResponse.json();
        setCounters(countersData.counters || []);
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  const handleSeatParty = async () => {
    if (!selectedTable) return;

    try {
      const response = await fetch("/api/pos/table-sessions", {

        headers: { "Content-Type": "application/json" },

          notes,
        }),

      if (response.ok) {
        setShowSeatDialog(false);
        setSelectedTable(null);
        fetchEntities();
      }
    } catch (_error) {
      // Error silently handled
    }
  };

  const handleTableAction = async (table: TableEntity, action: string) => {
    try {
      const response = await fetch("/api/pos/table-sessions", {

        headers: { "Content-Type": "application/json" },

          action,
        }),

      if (response.ok) {
        fetchEntities();
      }
    } catch (_error) {
      // Error silently handled
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "FREE":
        return "bg-green-100 text-green-800";
      case "OCCUPIED":
        return "bg-blue-100 text-blue-800";
      case "AWAITING_PAYMENT":
        return "bg-yellow-100 text-yellow-800";
      case "CLEANING":
        return "bg-orange-100 text-orange-800";
      case "RESERVED":
        return "bg-purple-100 text-purple-800";

    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "FREE":
        return <CheckCircle className="h-4 w-4" />;
      case "OCCUPIED":
        return <Users className="h-4 w-4" />;
      case "AWAITING_PAYMENT":
        return <CreditCard className="h-4 w-4" />;
      case "CLEANING":
        return <AlertTriangle className="h-4 w-4" />;
      case "RESERVED":
        return <Clock className="h-4 w-4" />;

    }
  };

  const formatTime = (dateString: string) => {
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

  const getPaymentModeIcons = (paymentModeMix: Record<string, number>) => {
    const icons = [];
    if (paymentModeMix.online) icons.push("💳");
    if (paymentModeMix.pay_at_till) icons.push("💰");
    if (paymentModeMix.pay_later) icons.push("⏰");
    return icons.join(" ");
  };

  if (loading) {
    return <div className="text-center py-8">Loading entities...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Tables Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Table className="h-6 w-6" />
          Tables ({tables.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map((table) => (
            <Card key={table.table_id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{table.table_label}</CardTitle>
                  <Badge className={getStatusColor(table.session_status)}>
                    {getStatusIcon(table.session_status)}
                    <span className="ml-1">{table.session_status}</span>
                  </Badge>
                </div>
                <div className="text-sm text-gray-900">
                  {table.area} • {table.seat_count} seats
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Session Info */}
                {table.session_id && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-gray-900" />
                      <span>{table.guest_count} guests</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-4 w-4 text-gray-900" />
                      <span>{formatTime(table.opened_at || table.last_order_at)}</span>
                    </div>
                  </div>
                )}

                {/* Order Info */}
                {table.active_orders_count > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Active Orders:</span>
                      <span className="font-semibold">{table.active_orders_count}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Total:</span>
                      <span className="font-semibold">£{table.total_amount.toFixed(2)}</span>
                    </div>
                    {table.unpaid_amount > 0 && (
                      <div className="flex items-center justify-between text-sm text-red-600">
                        <span>Unpaid:</span>
                        <span className="font-semibold">£{table.unpaid_amount.toFixed(2)}</span>
                      </div>
                    )}
                    {Object.keys(table.payment_mode_mix).length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>Payment:</span>
                        <span>{getPaymentModeIcons(table.payment_mode_mix)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {!table.session_id ? (
                    <Dialog
                      open={showSeatDialog && selectedTable?.table_id === table.table_id}
                      onOpenChange={(open) => {
                        setShowSeatDialog(open);
                        if (open) setSelectedTable(table);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" className="flex-1">
                          <Plus className="h-4 w-4 mr-1" />
                          Seat Party
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Seat Party at {table.table_label}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="guestCount">Guest Count</Label>
                            <Input
                              id="guestCount"
                              type="number"
                              min="1"
                              max={table.seat_count}
                              value={guestCount}
                              onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="server">Server</Label>
                            <Select value={serverId} onValueChange={setServerId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select server" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="current">Current User</SelectItem>
                                {/* Add more servers here */}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                              id="notes"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Special requests, allergies, etc."
                            />
                          </div>
                          <Button onClick={handleSeatParty} className="w-full">
                            Seat Party
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTableAction(table, "close_tab")}
                      >
                        <Receipt className="h-4 w-4 mr-1" />
                        Close Tab
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTableAction(table, "mark_cleaning")}
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Cleaning
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Counters Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          Counters ({counters.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {counters.map((counter) => (
            <Card key={counter.counter_id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{counter.counter_label}</CardTitle>
                  <Badge className={getStatusColor(counter.session_status)}>
                    {getStatusIcon(counter.session_status)}
                    <span className="ml-1">{counter.session_status}</span>
                  </Badge>
                </div>
                <div className="text-sm text-gray-900">{counter.area}</div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Session Info */}
                {counter.session_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <Timer className="h-4 w-4 text-gray-900" />
                    <span>{formatTime(counter.opened_at || counter.last_order_at)}</span>
                  </div>
                )}

                {/* Order Info */}
                {counter.active_orders_count > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Active Orders:</span>
                      <span className="font-semibold">{counter.active_orders_count}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Total:</span>
                      <span className="font-semibold">£{counter.total_amount.toFixed(2)}</span>
                    </div>
                    {counter.unpaid_amount > 0 && (
                      <div className="flex items-center justify-between text-sm text-red-600">
                        <span>Unpaid:</span>
                        <span className="font-semibold">£{counter.unpaid_amount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {!counter.session_id ? (
                    <Button size="sm" className="flex-1">
                      <Plus className="h-4 w-4 mr-1" />
                      Open Session
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        /* Handle close session */
                      }}
                    >
                      <Receipt className="h-4 w-4 mr-1" />
                      Close Session
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
