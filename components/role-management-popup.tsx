"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Shield, UserCheck, Settings, BarChart, Package, ChefHat } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  icon: React.ReactNode;
  color: string;
}

const ROLES: Role[] = [
  {
    id: "owner",
    name: "Owner",
    description: "Full access to all features and settings",
    permissions: [
      "View all orders and analytics",
      "Manage menu and inventory",
      "Staff management and roles",
      "Venue settings and billing",
      "Kitchen display system",
      "Table management"
    ],
    icon: <Crown className="h-5 w-5" />,
    color: "bg-yellow-100 text-yellow-800 border-yellow-200"
  },
  {
    id: "manager",
    name: "Manager",
    description: "Manage daily operations and staff",
    permissions: [
      "View orders and analytics",
      "Manage menu items",
      "Staff scheduling",
      "Kitchen display system",
      "Table management"
    ],
    icon: <Shield className="h-5 w-5" />,
    color: "bg-blue-100 text-blue-800 border-blue-200"
  },
  {
    id: "staff",
    name: "Staff",
    description: "Handle orders and basic operations",
    permissions: [
      "View live orders",
      "Update order status",
      "Kitchen display system",
      "Basic table management"
    ],
    icon: <UserCheck className="h-5 w-5" />,
    color: "bg-green-100 text-green-800 border-green-200"
  },
  {
    id: "kitchen",
    name: "Kitchen",
    description: "Focus on food preparation and orders",
    permissions: [
      "View kitchen display",
      "Update order preparation status",
      "View menu items"
    ],
    icon: <ChefHat className="h-5 w-5" />,
    color: "bg-orange-100 text-orange-800 border-orange-200"
  }
];

interface RoleManagementPopupProps {
  venueId: string;
  currentUserRole?: string;
  onRoleChange?: (newRole: string) => void;
}

export default function RoleManagementPopup({ 
  venueId, 
  currentUserRole = "owner",
  onRoleChange 
}: RoleManagementPopupProps) {
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>(currentUserRole);
  const [loading, setLoading] = useState(false);

  const handleRoleChange = async (roleId: string) => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Update user role in the database
      const { error } = await supabase
        .from("user_venue_roles")
        .update({ role: roleId })
        .eq("venue_id", venueId);

      if (error) {
        throw error;
      }

      setSelectedRole(roleId);
      onRoleChange?.(roleId);
      
      toast({
        title: "Role updated successfully",
        description: `Your role has been changed to ${ROLES.find(r => r.id === roleId)?.name}`,
      });

      setOpen(false);
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast({
        title: "Failed to update role",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const currentRole = ROLES.find(role => role.id === selectedRole);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Manage Roles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Role Management
          </DialogTitle>
          <DialogDescription>
            Select your role to customize your dashboard experience and permissions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Role Display */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${currentRole?.color}`}>
                {currentRole?.icon}
              </div>
              <div>
                <h3 className="font-semibold">Current Role</h3>
                <p className="text-sm text-muted-foreground">{currentRole?.description}</p>
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <h3 className="font-semibold">Available Roles</h3>
            {ROLES.map((role) => (
              <div
                key={role.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  selectedRole === role.id 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedRole(role.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${role.color}`}>
                    {role.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{role.name}</h4>
                      {selectedRole === role.id && (
                        <Badge variant="secondary" className="text-xs">
                          Selected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                    
                    {/* Permissions */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Permissions:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {role.permissions.map((permission, index) => (
                          <li key={index} className="flex items-center gap-1">
                            <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                            {permission}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => handleRoleChange(selectedRole)}
              disabled={loading || selectedRole === currentUserRole}
            >
              {loading ? "Updating..." : "Update Role"}
            </Button>
          </div>

          {/* Role Benefits */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">💡 Role Benefits</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Roles customize your dashboard view and available features</li>
              <li>• You can change your role anytime based on your current needs</li>
              <li>• Role permissions help organize team responsibilities</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
