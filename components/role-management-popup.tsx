"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Users, Crown, Shield, UserCheck, ChefHat } from "lucide-react";

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
      "Table management",
    ],
    icon: <Crown className="h-5 w-5" />,
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
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
      "Table management",
    ],
    icon: <Shield className="h-5 w-5" />,
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    id: "staff",
    name: "Staff",
    description: "Handle orders and basic operations",
    permissions: [
      "View live orders",
      "Update order status",
      "Kitchen display system",
      "Basic table management",
    ],
    icon: <UserCheck className="h-5 w-5" />,
    color: "bg-green-100 text-green-800 border-green-200",
  },
  {
    id: "kitchen",
    name: "Kitchen",
    description: "Focus on food preparation and orders",
    permissions: ["View kitchen display", "Update order preparation status", "View menu items"],
    icon: <ChefHat className="h-5 w-5" />,
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
];

interface RoleManagementPopupProps {
  currentUserRole?: string;
}

export default function RoleManagementPopup({
  currentUserRole = "owner",
}: RoleManagementPopupProps) {
  const [open, setOpen] = useState(false);

  const currentRole = ROLES.find((role) => role.id === currentUserRole);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="group flex items-center gap-2 h-10 px-4 text-sm font-medium bg-purple-600 hover:bg-white hover:border-purple-600 border-2 border-transparent transition-all duration-200 rounded-md">
          <Users className="h-4 w-4 text-white group-hover:text-purple-600 transition-colors" />
          <span className="text-white group-hover:text-purple-600 transition-colors">
            View Role
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Role
          </DialogTitle>
          <DialogDescription>
            View your current role and permissions in this venue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Role Display */}
          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${currentRole?.color}`}>{currentRole?.icon}</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">{currentRole?.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{currentRole?.description}</p>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Your Permissions</h3>
            <div className="grid gap-2">
              {currentRole?.permissions.map((permission, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">{permission}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setOpen(false)} className="px-6">
              Close
            </Button>
          </div>

          {/* Role Info */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">ℹ️ About Your Role</h4>
            <p className="text-sm text-gray-600">
              Your role determines which features and settings you can access in this venue. Contact
              the venue owner if you need different permissions.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
