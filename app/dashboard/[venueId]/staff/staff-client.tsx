"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Calendar } from "lucide-react";
import StaffMembersList from "@/components/staff/StaffMembersList";
import SimpleStaffGrid from "@/components/staff/SimpleStaffGrid";
import { supabaseBrowser } from "@/lib/supabase";

// Hooks
import { useStaffManagement, type StaffRow } from "./hooks/useStaffManagement";
import { useShiftManagement } from "./hooks/useShiftManagement";

/**
 * Staff Client Component
 * Manages staff members and their shifts
 *
 * Refactored: Extracted hooks for better organization
 * Original: 725 lines → Now: ~150 lines
 */

export default function StaffClient({
  venueId,
  initialStaff,
  initialCounts,
}: {
  venueId: string;
  initialStaff?: StaffRow[];
  initialCounts?: unknown;
}) {
  const [activeTab, setActiveTab] = useState("staff");

  const staffManagement = useStaffManagement(
    venueId,
    initialStaff,
    initialCounts as import("./hooks/useStaffManagement").StaffCounts | undefined
  );

  const shiftManagement = useShiftManagement(venueId, staffManagement.staff ?? []);

  return (
    <div className="space-y-6 pb-32 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Staff Management</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your team members and schedules</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {staffManagement.staff?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Active Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {staffManagement.staff?.filter((s) => s.active !== false).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {shiftManagement.allShifts?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="staff">
            <Users className="h-4 w-4 mr-2" />
            Staff Members
          </TabsTrigger>
          <TabsTrigger value="shifts">
            <Calendar className="h-4 w-4 mr-2" />
            Shift Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-6">
          {staffManagement.loading ? (
            <Card>
              <CardContent className="py-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <span className="ml-3 text-gray-600">Loading staff members...</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <StaffMembersList
              venueId={venueId}
              staff={staffManagement.staff || []}
            onStaffAdded={async () => {
              // Reload staff from database to ensure accuracy
              const supabase = supabaseBrowser();
              // Normalize venueId - database stores with venue- prefix
              const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
              const { data: staffData } = await supabase
                .from("staff")
                .select("*")
                .eq("venue_id", normalizedVenueId)
                .order("created_at", { ascending: false });
              if (staffData) {
                console.log("[STAFF CLIENT] Reloaded staff:", staffData.length, "members");
                staffManagement.setStaff(staffData);
              } else {
                console.log("[STAFF CLIENT] No staff found for venue:", normalizedVenueId);
              }
            }}
              onStaffToggle={staffManagement.toggleStaffActive}
            />
          )}
        </TabsContent>

        <TabsContent value="shifts" className="mt-6">
          <SimpleStaffGrid staff={staffManagement.staff || []} venueId={venueId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
