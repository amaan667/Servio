"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { StockLedger } from "@/types/inventory";

interface InventoryMovementsProps {

}

interface LedgerWithIngredient extends StockLedger {
  ingredient?: {

  };
  user?: {

  };
}

export function InventoryMovements({ venueId, canEdit: _canEdit = true }: InventoryMovementsProps) {
  const [movements, setMovements] = useState<LedgerWithIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const limit = 50;

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({

      if (reasonFilter !== "all") {
        params.append("reason", reasonFilter);
      }

      if (dateFrom) {
        params.append("from", new Date(dateFrom).toISOString());
      }

      if (dateTo) {
        params.append("to", new Date(dateTo + "T23:59:59").toISOString());
      }

      const response = await fetch(`/api/inventory/stock/movements?${params}`);
      const result = await response.json();

      if (result.data) {
        setMovements(result.data);
        setHasMore(result.data.length === limit);
      }
    } catch (_error) {
      // Error silently handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [venueId, reasonFilter, page, dateFrom, dateTo]);

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({

      if (reasonFilter !== "all") {
        params.append("reason", reasonFilter);
      }

      if (dateFrom) {
        params.append("from", new Date(dateFrom).toISOString());
      }

      if (dateTo) {
        params.append("to", new Date(dateTo + "T23:59:59").toISOString());
      }

      const response = await fetch(`/api/inventory/export/movements?${params}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movements-${venueId}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (_error) {
      // Error silently handled
    }
  };

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case "sale":
        return <Badge variant="destructive">Sale</Badge>;
      case "receive":
        return (
          <Badge variant="default" className="bg-green-600">
            Receive
          </Badge>
        );
      case "adjust":
        return <Badge variant="outline">Adjust</Badge>;
      case "waste":
        return <Badge variant="destructive">Waste</Badge>;
      case "stocktake":
        return <Badge variant="secondary">Stocktake</Badge>;
      case "return":
        return <Badge variant="outline">Return</Badge>;
      default:
        return <Badge>{reason}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {

    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Stock Movements</CardTitle>
              <CardDescription>View all inventory transactions</CardDescription>
            </div>
            <Button onClick={handleExportCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Reason</Label>
              <Select
                value={reasonFilter}
                onValueChange={(value) => {
                  setReasonFilter(value);
                  setPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reasons</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="receive">Receive</SelectItem>
                  <SelectItem value="adjust">Adjust</SelectItem>
                  <SelectItem value="waste">Waste</SelectItem>
                  <SelectItem value="stocktake">Stocktake</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading movements...</div>
        ) : movements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No stock movements found.</div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Delta</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>User</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(movement.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {movement.ingredient?.name || "Unknown"}
                      </TableCell>
                      <TableCell>{getReasonBadge(movement.reason)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {movement.delta > 0 ? (
                            <ArrowUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={movement.delta > 0 ? "text-green-600" : "text-red-600"}>
                            {movement.delta > 0 ? "+" : ""}
                            {movement.delta} {movement.ingredient?.unit}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {movement.note || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {movement.user?.email ? movement.user.email.split("@")[0] : "Auto"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
