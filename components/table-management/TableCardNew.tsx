"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MoreHorizontal,
  Users,
  Clock,
  Receipt,
  Calendar,
  ArrowRight,
  Square,
  QrCode,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusPill } from "./StatusPill";
import { useCloseTable, TableGridItem, useDeleteTable } from "@/hooks/useTableReservations";
import { useTableActions } from "@/hooks/useTableActions";
import { GroupSession } from "@/hooks/useGroupSessions";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { TableSelectionDialog } from "./TableSelectionDialog";
import { ReservationDialog } from "./ReservationDialog";
import { PaymentCollectionDialog } from "@/components/orders/PaymentCollectionDialog";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TableCardNewProps {

}

export function TableCardNew({
  table,
  venueId,
  onActionComplete,
  availableTables = [],
}: TableCardNewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [forceRemove, setForceRemove] = useState(false);
  const [showHoverRemove, setShowHoverRemove] = useState(false);
  const [isMerged, setIsMerged] = useState(false);
  const [mergedTableId, setMergedTableId] = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [orderDetails, setOrderDetails] = useState<{

    items: Array<{ item_name: string; quantity: number; price: number }>;

  } | null>(null);
  const closeTable = useCloseTable();
  const { occupyTable, unmergeTable } = useTableActions();
  const deleteTable = useDeleteTable(venueId);
  // Get group size for this table using passed groupSessions prop
  // const getTableGroupSize = () => {
  //   // Extract table number from label (e.g., "Table 5" -> 5)
  //   const tableNumber = parseInt(table.label.replace(/\D/g, '')) || null;
  //   if (!tableNumber) return null;
  //
  //   const session = groupSessions.find(gs => gs.table_number === tableNumber);
  //   return session ? session.total_group_size : null;
  // };

  // const tableGroupSize = getTableGroupSize();

  // Check if this table is merged (either has other tables merged into it OR is itself a merged result)
  useEffect(() => {
    const checkIfMerged = async () => {
      try {
        const supabase = createClient();

        // First check if this table has other tables merged into it (primary table)
        const { data: mergedIntoThis, error: error1 } = await supabase
          .from("tables")
          .select("id")
          .eq("venue_id", venueId)
          .eq("merged_with_table_id", table.id)
          .eq("is_active", true);

        // Also check if this table is itself merged into another table (secondary table)
        const { data: thisMergedInto, error: error2 } = await supabase
          .from("tables")
          .select("id, merged_with_table_id")
          .eq("venue_id", venueId)
          .eq("id", table.id)
          .eq("is_active", true)
          .single();

        // Check if the label indicates a merged table (fallback for display purposes)
        const isLabelMerged =
          table.label && (table.label.includes("+") || table.label.includes("merged with"));

        if (!error1 && !error2) {
          // This table is merged if:
          // 1. It has other tables merged into it (primary table), OR
          // 2. It is merged into another table (secondary table), OR
          // 3. Its label indicates it's a merged result
          const hasTablesMergedIntoThis = mergedIntoThis && mergedIntoThis.length > 0;
          const isThisMergedIntoAnother = thisMergedInto && thisMergedInto.merged_with_table_id;

          if (hasTablesMergedIntoThis || isThisMergedIntoAnother || isLabelMerged) {
            setIsMerged(true);
            // For unmerge, we need the secondary table ID
            if (isThisMergedIntoAnother) {
              setMergedTableId(table.id); // This table is the secondary table
            } else if (hasTablesMergedIntoThis) {
              setMergedTableId(mergedIntoThis[0].id); // The first table merged into this one
            } else {
              // Fallback: if we can't determine the exact relationship, use this table's ID
              setMergedTableId(table.id);
            }
          } else {
            setIsMerged(false);
            setMergedTableId(null);
          }
        } else {
          // Fallback to label-based detection
          if (isLabelMerged) {
            setIsMerged(true);
            setMergedTableId(table.id);
          } else {
            setIsMerged(false);
            setMergedTableId(null);
          }
        }
      } catch {
        // Fallback to label-based detection
        const isLabelMerged =
          table.label && (table.label.includes("+") || table.label.includes("merged with"));
        if (isLabelMerged) {
          setIsMerged(true);
          setMergedTableId(table.id);
        } else {
          setIsMerged(false);
          setMergedTableId(null);
        }
      }
    };

    checkIfMerged();
  }, [table.id, venueId, table.label]);

  const handleOccupyTable = async () => {
    try {
      setIsLoading(true);
      await occupyTable(table.id, venueId);
      onActionComplete?.();
    } catch {
      // Error handled by occupyTable function
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseTable = async () => {
    try {
      setIsLoading(true);
      await closeTable.mutateAsync({ tableId: table.id, venueId: venueId });
      onActionComplete?.();
    } catch {
      // Error handled by closeTable mutation
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnmergeTable = async () => {
    if (!mergedTableId) return;

    try {
      setIsLoading(true);
      await unmergeTable(mergedTableId, venueId);
      onActionComplete?.();
    } catch {
      // Error handled by unmergeTable function
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTable = async () => {
    // Close modal immediately for instant feedback
    const shouldForceRemove = forceRemove;
    setShowRemoveDialog(false);
    setForceRemove(false);
    setRemoveError(null);

    // Use the mutation hook - table will disappear INSTANTLY
    deleteTable.mutate(
      { tableId: table.id, force: shouldForceRemove },
      {

        },

          } else if (typeof error === "string") {
            errorMessage = error;
          } else if (error && typeof error === "object") {
            errorMessage = JSON.stringify(error);
          }

          setRemoveError(errorMessage);
          // Reopen the dialog to show the error
          setShowRemoveDialog(true);
        },
      }
    );
  };

  const handleCollectPayment = async () => {
    if (!table.order_id) return;

    try {
      const supabase = createClient();
      const { data: order } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, items, total_amount, payment_status")
        .eq("id", table.order_id)
        .single();

      if (order && order.payment_status !== "PAID") {
        setOrderDetails({

        setShowPaymentDialog(true);
      }
    } catch {
      // Silently handle payment order load error
    }
  };

  const getContextualActions = () => {
    const actions = [];

    if (table.session_status === "FREE") {
      actions.push(
        <DropdownMenuItem key="occupy" onClick={handleOccupyTable} disabled={isLoading}>
          <Users className="h-4 w-4 mr-2" />
          Occupy Table
        </DropdownMenuItem>
      );
      actions.push(
        <DropdownMenuItem key="reserve" onClick={() => setShowReservationDialog(true)}>
          <Calendar className="h-4 w-4 mr-2" />
          Make Reservation
        </DropdownMenuItem>
      );
    }

    if (table.session_status === "OCCUPIED") {
      // Add collect payment option if order is served and unpaid
      const needsPayment =
        table.order_status === "SERVED" &&
        table.payment_status !== "PAID" &&
        (table.payment_status === "PAY_AT_TILL" ||
          table.payment_status === "TILL" ||
          table.payment_status === "UNPAID");

      if (table.order_id && needsPayment) {
        actions.push(
          <DropdownMenuItem
            key="collect-payment"
            onClick={handleCollectPayment}
            className="text-orange-600 font-medium"
          >
            <Receipt className="h-4 w-4 mr-2" />
            Collect Payment at Till
          </DropdownMenuItem>
        );
      }

      if (table.order_id) {
        actions.push(
          <DropdownMenuItem
            key="view-order"
            onClick={async () => {
              // Use the same logic as the black "View Orders" button
              // Determine which tab to navigate to based on order age
              const tableLabel = table.label;

              // If we have an order_id, we need to check when that specific order was created
              if (table.order_id) {
                try {
                  const supabase = createClient();
                  const { data: orderData, error } = await supabase
                    .from("orders")
                    .select("created_at")
                    .eq("id", table.order_id)
                    .single();

                  if (orderData && !error) {
                    // Simply navigate to live orders with table filter
                    // The filter will search through both live and all tabs automatically
                    router.push(`/dashboard/${venueId}/live-orders?table=${tableLabel}`);
                    return;
                  }
                } catch {
                  // Failed to fetch order, use fallback
                }
              }

              // Fallback: if we can't determine the order age, go to live tab
              router.push(`/dashboard/${venueId}/live-orders?table=${tableLabel}&tab=live`);
            }}
          >
            <Receipt className="h-4 w-4 mr-2" />
            View Order
          </DropdownMenuItem>
        );
      }
      actions.push(
        <DropdownMenuItem key="close" onClick={handleCloseTable} disabled={isLoading}>
          <Square className="h-4 w-4 mr-2" />
          Close Table
        </DropdownMenuItem>
      );
    }

    if (table.session_status === "RESERVED") {
      actions.push(
        <DropdownMenuItem key="modify-reservation" onClick={() => setShowReservationDialog(true)}>
          <Calendar className="h-4 w-4 mr-2" />
          Modify Reservation
        </DropdownMenuItem>
      );
    }

    // Add unmerge option if table is merged
    if (isMerged) {
      actions.push(
        <DropdownMenuItem key="unmerge" onClick={handleUnmergeTable} disabled={isLoading}>
          <X className="h-4 w-4 mr-2" />
          Unmerge Table
        </DropdownMenuItem>
      );
    }

    return actions;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {

  };

  const getTimeElapsed = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMins = Math.floor((now.getTime() - past.getTime()) / (1000 * 60));

    if (diffMins < 60) {
      return `${diffMins}m`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const handleQRCodeClick = () => {
    // Navigate to the old QR codes page with this table pre-selected
    router.push(`/dashboard/${venueId}/qr-codes?table=${encodeURIComponent(table.label)}`);
  };

  return (
    <Card
      className="group hover:shadow-md transition-shadow duration-200 relative"
      onMouseEnter={() => setShowHoverRemove(true)}
      onMouseLeave={() => setShowHoverRemove(false)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{table.label}</h3>
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {table.seat_count} seats
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            {/* Remove Table Button - appears on hover */}
            <div
              className={`transition-opacity duration-200 ${showHoverRemove ? "opacity-100" : "opacity-0"}`}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setShowRemoveDialog(true)}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove Table</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={handleQRCodeClick}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Generate QR Code</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" className="w-48">
                {getContextualActions()}
                <DropdownMenuItem onClick={() => setShowMoveDialog(true)}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Move to...
                </DropdownMenuItem>
                {!isMerged && (
                  <DropdownMenuItem onClick={() => setShowMergeDialog(true)}>
                    <MoreHorizontal className="h-4 w-4 mr-2" />
                    Merge with...
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusPill
              status={
                table.session_status as
                  | "IN_PREP"
                  | "READY"
                  | "FREE"
                  | "SERVED"
                  | "ORDERING"
                  | "CLOSED"
                  | "OCCUPIED"
                  | "RESERVED"
                  | "AWAITING_BILL"
              }
            />
          </div>

          {table.order_id && (
            <div className="text-sm text-gray-900 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Order #{table.order_id.slice(-6)}</span>
              </div>

              {table.total_amount && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span>£{(table.total_amount / 100).toFixed(2)}</span>
                    {table.order_status && (
                      <Badge variant="outline" className="text-xs">
                        {table.order_status}
                      </Badge>
                    )}
                  </div>
                  {table.payment_status && table.payment_status !== "PAID" && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-orange-50 text-orange-700 border-orange-200"
                    >
                      {table.payment_status === "PAY_AT_TILL" || table.payment_status === "TILL"
                        ? "💳 Pay at Till"

                          : "Unpaid"}
                    </Badge>
                  )}
                </div>
              )}

              {table.opened_at && (
                <div className="flex items-center gap-1 text-xs text-gray-900">
                  <Clock className="h-3 w-3" />
                  <span>Open {formatTime(table.opened_at)}</span>
                  <span>• {getTimeElapsed(table.opened_at)} ago</span>
                </div>
              )}
            </div>
          )}

          {!table.order_id && table.session_status === "FREE" && (
            <div className="text-sm text-gray-900">Available for seating</div>
          )}

          {table.session_status === "RESERVED" && (
            <div className="text-sm text-gray-900">
              {table.reservation_status === "RESERVED_NOW"
                ? "Reserved - Check in available"
                : "Reserved for later"}
            </div>
          )}
        </div>

        {/* Reserved Badge - only show if table is FREE but has a reservation (edge case) */}
        {table.session_status === "FREE" &&
          (table.reservation_status === "RESERVED_NOW" ||
            table.reservation_status === "RESERVED_LATER") && (
            <div className="absolute bottom-3 right-3">
              <Badge
                variant="outline"
                className={`text-xs ${
                  table.reservation_status === "RESERVED_NOW"
                    ? "bg-red-50 text-red-700 border-red-200"

                }`}
              >
                <Calendar className="h-3 w-3 mr-1" />
                {table.reservation_status === "RESERVED_NOW" ? "Reserved Now" : "Reserved Later"}
              </Badge>
            </div>
          )}
      </CardContent>

      {/* Table Selection Dialogs */}
      <TableSelectionDialog
        isOpen={showMoveDialog}
        onClose={() => setShowMoveDialog(false)}
        sourceTable={{

        }}
        action="move"
        venueId={venueId}
        availableTables={availableTables.map((t) => ({

        }))}
        onActionComplete={onActionComplete}
      />

      <TableSelectionDialog
        isOpen={showMergeDialog}
        onClose={() => setShowMergeDialog(false)}
        sourceTable={{

        }}
        action="merge"
        venueId={venueId}
        availableTables={availableTables.map((t) => ({

        }))}
        onActionComplete={onActionComplete}
      />

      <ReservationDialog
        isOpen={showReservationDialog}
        onClose={() => setShowReservationDialog(false)}
        tableId={table.id}
        tableLabel={table.label}
        tableSeatCount={table.seat_count}
        venueId={venueId}
        tableStatus={table.session_status}
        onReservationComplete={onActionComplete}
      />

      {/* Payment Collection Dialog */}
      {orderDetails && (
        <PaymentCollectionDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          orderId={orderDetails.id}
          orderNumber={orderDetails.number}
          customerName={orderDetails.customer}
          totalAmount={orderDetails.total}
          venueId={venueId}
          items={orderDetails.items}
          onSuccess={() => {
            setShowPaymentDialog(false);
            setOrderDetails(null);
            onActionComplete?.();
          }}
        />
      )}

      {/* Remove Table Confirmation Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Table</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove &quot;{table.label}&quot;? This action cannot be
              undone.
              {table.session_status === "OCCUPIED" && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠️ This table is currently occupied. Removing it may affect active orders.
                </span>
              )}
              {removeError && (
                <span className="block mt-2 text-red-600 font-medium">❌ {removeError}</span>
              )}
              {removeError && removeError.includes("active orders") && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={forceRemove}
                      onChange={(e) => setForceRemove(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-orange-800">
                      Force remove (complete active orders and remove table anyway)
                    </span>
                  </label>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRemoveDialog(false);
                setRemoveError(null);
                setForceRemove(false);
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => handleRemoveTable()} disabled={isLoading}>
              {isLoading ? "Removing..." : "Remove Table"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
