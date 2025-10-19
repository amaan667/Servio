'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users } from 'lucide-react';
import SimpleStaffGrid from '@/components/staff/SimpleStaffGrid';
import EnhancedShiftSchedule from '@/components/staff/EnhancedShiftSchedule';

// Hooks
import { useStaffManagement } from './hooks/useStaffManagement';
import { useShiftManagement } from './hooks/useShiftManagement';

/**
 * Staff Client Component
 * Manages staff members and their shifts
 * 
 * Refactored: Extracted hooks for better organization
 * Original: 725 lines → Now: ~150 lines
 */

export default function StaffClient({
  venueId,
  venueName,
  initialStaff,
  initialCounts,
}: {
  venueId: string;
  venueName?: string;
  initialStaff?: any[];
  initialCounts?: any;
}) {
  const [activeTab, setActiveTab] = useState('staff');

  const staffManagement = useStaffManagement(venueId, initialStaff, initialCounts);
  const shiftManagement = useShiftManagement(venueId, staffManagement.staff);

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
            <div className="text-2xl font-bold text-gray-900">{staffManagement.staff.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Active Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {staffManagement.staff.filter(s => s.active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{shiftManagement.allShifts.length}</div>
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
            <Users className="h-4 w-4 mr-2" />
            Shift Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-6">
          <SimpleStaffGrid
            venueId={venueId}
            staff={staffManagement.staff}
            onStaffAdded={() => {
              // Refetch staff data
              window.location.reload();
            }}
            onStaffToggle={staffManagement.toggleStaffActive}
          />
        </TabsContent>

        <TabsContent value="shifts" className="mt-6">
          <EnhancedShiftSchedule
            venueId={venueId}
            staff={staffManagement.staff}
            shifts={shiftManagement.allShifts}
            onShiftAdded={shiftManagement.addShift}
            onShiftDeleted={shiftManagement.deleteShift}
            editingShiftFor={shiftManagement.editingShiftFor}
            onEditShift={shiftManagement.setEditingShiftFor}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
