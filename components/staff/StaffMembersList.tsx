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
import { UserPlus, UserMinus, Users } from "lucide-react";

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

  const handleAddStaff = async () => {
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/staff/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue_id: venueId, name, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add staff member");
      }

      setName("");
      setRole("Server");
      if (onStaffAdded) onStaffAdded();
    } catch (_err) {
      setError(err instanceof Error ? err.message : "Failed to add staff member");
    } finally {
      setAdding(false);
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
                <SelectTrigger id="role">
                  <SelectValue />
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
              <Button onClick={handleAddStaff} disabled={adding || !name.trim()} className="w-full">
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
                  <div className="flex gap-2 mt-3">
                    {onStaffToggle && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onStaffToggle(member.id, member.active)}
                        className="flex-1"
                      >
                        <UserMinus className="h-4 w-4 mr-1" />
                        {member.active ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffMembersList;
