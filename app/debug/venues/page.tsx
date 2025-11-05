"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DebugVenuesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/debug/my-venues")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setData(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>🔍 Debug: Your Venues</CardTitle>
            <CardDescription>
              This shows which venue you should be redirected to after sign-in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">User ID:</p>
              <p className="font-mono text-sm">{data?.userId}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Venues:</p>
              <p className="font-semibold text-lg">{data?.venueCount}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">First Venue (where sign-in redirects):</p>
              <p className="font-mono text-sm">{data?.firstVenue || "None"}</p>
              {data?.firstVenueName && (
                <p className="text-sm text-gray-500">{data.firstVenueName}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Redirect Path:</p>
              <p className="font-mono text-sm text-purple-600">{data?.redirectWouldGoTo}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">All Venues (in order):</h2>
          {data?.venues?.map((venue: Record<string, unknown>, index: number) => {
            const venueName = venue.venue_name as string || venue.venue_id as string;
            const createdAt = new Date(venue.created_at as string).toLocaleString();
            return (
              <Card key={venue.venue_id as string} className={index === 0 ? "border-purple-600 border-2" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {index === 0 && (
                      <Badge className="bg-purple-600">FIRST - Sign-in goes here</Badge>
                    )}
                    {venueName}
                  </CardTitle>
                  <CardDescription>
                    Created: {createdAt}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Venue ID:</p>
                  <p className="font-mono text-xs">{venue.venue_id as string}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Organization ID:</p>
                  <p className="font-mono text-xs">{(venue.organization_id as string) || "None"}</p>
                </div>
                {(() => {
                  const org = venue.organization as Record<string, unknown> | undefined | null;
                  if (org) {
                    return (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                        <p className="text-sm font-semibold text-green-800">✅ Has Organization</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Tier: {(org.subscription_tier as string) || "None"}
                        </p>
                        <p className="text-xs text-gray-600">
                          Stripe:{" "}
                          {org.stripe_customer_id ? "✓ Connected" : "✗ Not connected"}
                        </p>
                      </div>
                    );
                  } else {
                    return (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-sm font-semibold text-yellow-800">⚠️ No Organization</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Settings page will show "No organization found"
                        </p>
                      </div>
                    );
                  }
                })()}
              </CardContent>
            </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
