"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";

interface LowStockBannerProps {
  venueId: string;
}

export function LowStockBanner({ venueId }: LowStockBannerProps) {
  const { alerts, loading } = useInventoryAlerts(venueId);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (loading || alerts.length === 0 || dismissed) {
    return null;
  }

  const criticalAlerts = alerts.filter((alert) => alert.current_stock <= 0);
  const warningAlerts = alerts.filter(
    (alert) => alert.current_stock > 0 && alert.current_stock <= alert.reorder_level
  );

  return (
    <Alert variant="destructive" className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-950">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <AlertTitle className="text-amber-900 dark:text-amber-100">Inventory Alert</AlertTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-amber-900 dark:text-amber-100"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
              className="text-amber-900 dark:text-amber-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <AlertDescription className="text-amber-800 dark:text-amber-200 mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            {criticalAlerts.length > 0 && (
              <Badge variant="destructive">{criticalAlerts.length} out of stock</Badge>
            )}
            {warningAlerts.length > 0 && (
              <Badge variant="outline" className="border-amber-500 text-amber-700">
                {warningAlerts.length} low stock
              </Badge>
            )}
            <Link href={`/dashboard/${venueId}/inventory`}>
              <Button variant="link" className="text-amber-900 dark:text-amber-100 p-0 h-auto">
                View Inventory →
              </Button>
            </Link>
          </div>

          {expanded && (
            <div className="mt-4 space-y-2">
              {alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.ingredient_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium">{alert.ingredient_name}</span>
                  <div className="flex items-center gap-2">
                    <span>
                      {alert.current_stock} {alert.unit}
                      {alert.current_stock <= 0 ? " (OUT)" : ` / ${alert.reorder_level}`}
                    </span>
                    {alert.affected_menu_items.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {alert.affected_menu_items.length} items affected
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {alerts.length > 5 && (
                <div className="text-sm text-muted-foreground">And {alerts.length - 5} more...</div>
              )}
            </div>
          )}
        </AlertDescription>
      </div>
    </Alert>
  );
}
