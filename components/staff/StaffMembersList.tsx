"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Calendar, Users, Mail } from "lucide-react";
import { AddShiftModal } from "./AddShiftModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStaffInvitation } from "@/hooks/useStaffInvitation";

type StaffMember = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
};

interface StaffMembersListProps {
  staff: StaffMember[];
  venueId: string;
  onStaffAdded?: () => void;
  onStaffToggle?: (staffId: string, currentActive: boolean) => Promise<void>;
}

const StaffMembersList: React.FC<StaffMembersListProps> = ({
  staff,
  venueId,
  onStaffAdded,
  onStaffToggle,
}) => {
  const [name, setName] = useState("");
  const [role, setRole] = useState("Server");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [selectedStaffForShift, setSelectedStaffForShift] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const invitation = useStaffInvitation({
    venueId,
    onSuccess: () => {
      // Optionally reload staff list after invitation
    },
  });

  const handleAddStaff = async () => {
    console.log("=".repeat(80));
    console.log("[ADD STAFF CLICK] Button clicked - starting add staff process");
    console.log("[ADD STAFF CLICK] Form data - name:", name, "role:", role);
    console.log("[ADD STAFF CLICK] Raw venueId:", venueId);
    
    if (!name.trim()) {
      console.log("[ADD STAFF CLICK] VALIDATION FAILED - Name is empty");
      setError("Please enter a name");
      return;
    }

    setAdding(true);
    setError(null);

    try {
      // Add venueId to query string for withUnifiedAuth
      // Normalize venueId - ensure it has venue- prefix
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
      console.log("[ADD STAFF CLICK] Normalized venueId:", normalizedVenueId);
      
      const url = new URL("/api/staff/add", window.location.origin);
      url.searchParams.set("venueId", normalizedVenueId);
      console.log("[ADD STAFF CLICK] API URL:", url.toString());
      
      const requestBody = { venue_id: normalizedVenueId, name: name.trim(), role };
      console.log("[ADD STAFF CLICK] Request body:", JSON.stringify(requestBody, null, 2));
      
      const requestStart = Date.now();
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });
      const requestTime = Date.now() - requestStart;

      console.log("[ADD STAFF CLICK] API request completed in", requestTime, "ms");
      console.log("[ADD STAFF CLICK] Response status:", res.status, res.statusText);
      console.log("[ADD STAFF CLICK] Response headers:", Object.fromEntries(res.headers.entries()));

      const data = await res.json();
      console.log("[ADD STAFF CLICK] Response data:", JSON.stringify(data, null, 2));

      if (!res.ok) {
        const errorMessage = data.error?.message || data.error || data.message || "Failed to add staff member";
        console.error("[ADD STAFF CLICK] ERROR - API request failed:");
        console.error("[ADD STAFF CLICK] Status:", res.status);
        console.error("[ADD STAFF CLICK] Error message:", errorMessage);
        console.error("[ADD STAFF CLICK] Full error response:", JSON.stringify(data, null, 2));
        throw new Error(errorMessage);
      }

      console.log("[ADD STAFF CLICK] SUCCESS - Staff member added successfully");
      console.log("[ADD STAFF CLICK] Added staff data:", JSON.stringify(data, null, 2));
      setName("");
      setRole("Server");
      if (onStaffAdded) {
        console.log("[ADD STAFF CLICK] Calling onStaffAdded callback to reload staff list");
        await onStaffAdded();
        console.log("[ADD STAFF CLICK] onStaffAdded callback completed");
      }
      console.log("[ADD STAFF CLICK] Add staff process completed successfully");
      console.log("=".repeat(80));
    } catch (err) {
      console.error("[ADD STAFF CLICK] EXCEPTION - Unexpected error:");
      console.error("[ADD STAFF CLICK] Exception type:", err instanceof Error ? err.constructor.name : typeof err);
      console.error("[ADD STAFF CLICK] Exception message:", err instanceof Error ? err.message : String(err));
      console.error("[ADD STAFF CLICK] Exception stack:", err instanceof Error ? err.stack : "no stack");
      const errorMessage = err instanceof Error ? err.message : "Failed to add staff member";
      setError(errorMessage);
      console.log("=".repeat(80));
    } finally {
      setAdding(false);
      console.log("[ADD STAFF CLICK] Loading state set to false");
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Staff Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Staff Member
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddStaff()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger
                  id="role"
                  className="bg-purple-600 text-white border-purple-600 hover:bg-purple-700 [&>span]:text-white hover:[&>span]:text-white"
                >
                  <SelectValue className="text-white !text-white" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Server">Server</SelectItem>
                  <SelectItem value="Chef">Chef</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Bartender">Bartender</SelectItem>
                  <SelectItem value="Host">Host</SelectItem>
                  <SelectItem value="Kitchen Staff">Kitchen Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAddStaff}
                disabled={adding || !name.trim()}
                className="w-full bg-purple-600 text-white hover:bg-purple-700"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {adding ? "Adding..." : "Add Staff"}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </CardContent>
      </Card>

      {/* Staff List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Members ({staff?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!staff || staff.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No staff members yet</p>
              <p className="text-sm">Add your first staff member above</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className="p-4 border rounded-lg bg-white hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-600">{member.role}</p>
                    </div>
                    <Badge
                      variant={member.active ? "default" : "secondary"}
                      className={member.active ? "bg-green-500" : "bg-gray-400"}
                    >
                      {member.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="mt-3 pt-3 border-t space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Active</span>
                      {onStaffToggle && (
                        <Switch
                          checked={member.active}
                          onCheckedChange={() => onStaffToggle(member.id, member.active)}
                        />
                      )}
                    </div>
                    <div className="flex gap-2 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => invitation.handleInviteClick(member)}
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 flex-1"
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Invite
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedStaffForShift({ id: member.id, name: member.name });
                          setShiftModalOpen(true);
                        }}
                        className="flex-1"
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        Add Shift
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Shift Modal */}
      <AddShiftModal
        isOpen={shiftModalOpen}
        onClose={() => {
          setShiftModalOpen(false);
          setSelectedStaffForShift(null);
        }}
        staffMember={selectedStaffForShift}
        venueId={venueId}
        onShiftAdded={() => {
          if (onStaffAdded) onStaffAdded();
        }}
      />

      {/* Invite Dialog */}
      <Dialog open={invitation.inviteDialogOpen} onOpenChange={invitation.closeInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
            <DialogDescription>
              {invitation.selectedStaffForInvite
                ? `Invite someone to join with the same role as ${invitation.selectedStaffForInvite.name} (${invitation.selectedStaffForInvite.role}).`
                : "Please select a staff member to invite someone with the same role."}
            </DialogDescription>
          </DialogHeader>
          {invitation.selectedStaffForInvite && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={invitation.inviteEmail}
                  onChange={(e) => invitation.setInviteEmail(e.target.value)}
                  disabled={invitation.inviteLoading}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      invitation.inviteEmail.trim() &&
                      !invitation.inviteLoading
                    ) {
                      invitation.handleSendInvite();
                    }
                  }}
                />
                <p className="text-sm text-gray-500">
                  The invited person will receive {invitation.selectedStaffForInvite.role} role
                  access.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={invitation.closeInviteDialog}
                  disabled={invitation.inviteLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={invitation.handleSendInvite}
                  disabled={invitation.inviteLoading || !invitation.inviteEmail.trim()}
                  className="bg-purple-600 text-white hover:bg-purple-700"
                >
                  {invitation.inviteLoading ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffMembersList;
