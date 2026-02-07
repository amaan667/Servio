"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import QRCodeClient from "./QRCodeClient";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import type { UserRole } from "@/lib/permissions";
import type { QRCodeStats } from "./page";

interface TableItem {
  id?: string;
  table_id?: string;
  label?: string;
  table_number?: string | number | null;
  name?: string;
}

interface CounterItem {
  id?: string;
  counter_id?: string;
  name?: string;
  label?: string;
  counter_name?: string;
}

export default function QRCodeClientPage({
  venueId,
  role,
  tier,
  venueName: initialVenueName,
  stats,
  initialTables = [],
  initialCounters = [],
}: {
  venueId: string;
  tier: string;
  role: string;
  venueName?: string;
  stats?: QRCodeStats;
  initialTables?: Array<{ id: string; label: string; table_number: string | number | null }>;
  initialCounters?: Array<{ id: string; name: string }>;
}) {
  // Use tier if needed, otherwise suppress unused warning
  void tier;
  const { user } = useAuthRedirect();
  const userRole = role as UserRole;
  const [venueName, setVenueName] = useState<string>(initialVenueName || "My Venue");
  const [tables, setTables] = useState<TableItem[]>(initialTables || []);
  const [counters, setCounters] = useState<CounterItem[]>(initialCounters || []);
  const [loading, setLoading] = useState(false);

  // Fetch venue name if not provided
  useEffect(() => {
    if (!user?.id && !initialVenueName) {
      const fetchVenueName = async () => {
        const supabase = supabaseBrowser();
        const { data } = await supabase
          .from("venues")
          .select("venue_name")
          .eq("venue_id", venueId)
          .single();
        if (data?.venue_name) {
          setVenueName(data.venue_name);
        }
      };
      void fetchVenueName();
    }
  }, [user?.id, venueId, initialVenueName]);

  // Fetch tables and counters if not provided
  useEffect(() => {
    if (!user?.id && initialTables.length === 0 && initialCounters.length === 0) {
      loadTablesAndCounters();
    }
  }, [user?.id, venueId, initialTables.length, initialCounters.length]);

  const loadTablesAndCounters = async () => {
    try {
      setLoading(true);
      const supabase = supabaseBrowser();

      const { data: tablesData, error: tablesError } = await supabase
        .from("tables")
        .select("*")
        .eq("venue_id", venueId)
        .order("label", { ascending: true });

      if (tablesError) {
        console.error("[QR Codes] Error loading tables:", tablesError);
      }

      let countersData: CounterItem[] = [];
      try {
        const result = await supabase.from("counters").select("*").eq("venue_id", venueId);
        if (!result.error) {
          countersData = result.data || [];
        }
      } catch {
        // Silently fail - counters are optional
      }

      setTables(tablesData || []);
      setCounters(countersData);
    } catch (error) {
      console.error("[QR Codes] Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  // Render immediately - no blocking

  // Don't render if no user (will redirect)
  if (!user) {
    return null;
  }

  // Build initial QR data from server-fetched tables/counters
  const generatedQRs = [
    ...tables
      .filter((t) => t.label || t.table_number)
      .map((t) => ({
        name: String(t.label || t.table_number || ""),
        url: `${typeof window !== "undefined" ? window.location.origin : ""}/order?venue=${venueId}&table=${encodeURIComponent(String(t.label || t.table_number || ""))}`,
        type: "table" as const,
      })),
    ...counters
      .filter((c) => c.name)
      .map((c) => ({
        name: String(c.name || c.label || ""),
        url: `${typeof window !== "undefined" ? window.location.origin : ""}/order?venue=${venueId}&counter=${encodeURIComponent(String(c.name || c.label || ""))}`,
        type: "counter" as const,
      })),
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {/* Always render navigation if we have a venueId, show loading state while fetching role */}
        {venueId && (
          <RoleBasedNavigation
            venueId={venueId}
            userRole={userRole || "staff"}
            userName={user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}
          />
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-card rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Total QR Codes</div>
              <div className="text-2xl font-bold">{stats.totalQRCodes}</div>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Active Codes</div>
              <div className="text-2xl font-bold text-green-600">{stats.activeCodes}</div>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Tables</div>
              <div className="text-2xl font-bold">{stats.tableCount}</div>
            </div>
            <div className="bg-card rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">Counters</div>
              <div className="text-2xl font-bold">{stats.counterCount}</div>
            </div>
          </div>
        )}

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">QR Code Generator</h1>
          <p className="text-lg text-foreground mt-2">
            Generate and manage QR codes for your tables and counters
          </p>
        </div>

        <QRCodeClient
          venueId={venueId}
          venueName={venueName}
          initialTables={tables}
          initialCounters={counters}
          initialLoading={loading}
        />
      </div>
    </div>
  );
}
