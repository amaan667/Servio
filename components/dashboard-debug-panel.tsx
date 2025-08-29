"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  type AuthSession,
  type OrderWithItems,
} from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";

interface DebugPanelProps {
  session: AuthSession;
}

export function DashboardDebugPanel({ session }: DebugPanelProps) {
  const [rawOrders, setRawOrders] = useState<OrderWithItems[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const handleFetchRawOrders = async () => {
    setIsFetching(true);
    setFetchError(null);
    setRawOrders(null);

    try {
      const { data: venueData, error: venueError } = await createClient()
        .from("venues")
        .select("id")
        .eq("venue_id", session.venue.venue_id)
        .single();

      if (venueError || !venueData) {
        throw new Error(
          `Failed to find venue UUID for ${session.venue.venue_id}`,
        );
      }

      // This fetch uses the logged-in user's permissions, so it's a perfect test of RLS.
      const { data, error } = await createClient()
        .from("orders")
        .select("*, order_items(*)")
        .eq("venue_id", venueData.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        throw error;
      }

      setRawOrders(data);
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <Card className="bg-yellow-50 border-yellow-300">
      <CardHeader>
        <CardTitle>🔧 Debug Panel</CardTitle>
        <CardDescription>
          This panel shows your current session data to help diagnose issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div>
          <h4 className="font-bold">Session Info:</h4>
          <p>
            <strong>User ID:</strong> {session.user.id}
          </p>
          <p>
            <strong>User Email:</strong> {session.user.email}
          </p>
          <p>
            <strong>Venue ID (string):</strong> {session.venue.venue_id}
          </p>
          <p>
            <strong>Venue Name:</strong> {session.venue.name}
          </p>
        </div>
        <div>
          <Button
            onClick={handleFetchRawOrders}
            disabled={isFetching}
            size="sm"
          >
            {isFetching ? "Fetching..." : "Test: Fetch Raw Orders"}
          </Button>
        </div>
        {fetchError && (
          <div>
            <h4 className="font-bold text-red-600">Fetch Error:</h4>
            <pre className="bg-red-100 text-red-800 p-2 rounded-md mt-1">
              {fetchError}
            </pre>
          </div>
        )}
        {rawOrders && (
          <div>
            <h4 className="font-bold text-green-600">
              Fetch Success (Last 5 Orders):
            </h4>
            {rawOrders.length === 0 ? (
              <p className="text-gray-600">
                The query returned 0 orders. This might be expected or could
                indicate an RLS issue if you know orders exist.
              </p>
            ) : (
              <pre className="bg-gray-100 text-gray-800 p-2 rounded-md mt-1 whitespace-pre-wrap break-all">
                {JSON.stringify(rawOrders, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
