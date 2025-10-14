'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import TimeField24, { TimeValue24 } from '@/components/inputs/TimeField24';
import { buildIsoFromLocal, isOvernight, addDaysISO } from '@/lib/time';
import { Users, Clock, Calendar, ChevronLeft, ChevronRight, Plus, ArrowLeft, Settings, UserPlus, FileText, Download } from 'lucide-react';
import SimpleStaffGrid from '@/components/staff/SimpleStaffGrid';

type StaffRow = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  created_at: string;
};

type LegacyShift = { 
  id: string; 
  staff_id: string; 
  start_time: string; 
  end_time: string; 
  area?: string;
  staff_name: string;
  staff_role: string;
};

interface StaffCounts {
  total_staff: number;
  active_staff: number;
  unique_roles: number;
  active_shifts_count: number;
}

interface StaffClientProps {
  venueId: string;
  venueName: string;
}

export default function StaffClient({ venueId, venueName }: StaffClientProps) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [shifts, setShifts] = useState<LegacyShift[]>([]);
  const [counts, setCounts] = useState<StaffCounts>({
    total_staff: 0,
    active_staff: 0,
    unique_roles: 0,
    active_shifts_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'staff' | 'shifts' | 'reports' | 'settings'>('staff');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const router = useRouter();

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      // Mock data for demo
      const mockStaff: StaffRow[] = [
        { id: '1', name: 'John Smith', role: 'Manager', active: true, created_at: '2024-01-15' },
        { id: '2', name: 'Sarah Johnson', role: 'Server', active: true, created_at: '2024-01-20' },
        { id: '3', name: 'Mike Davis', role: 'Chef', active: true, created_at: '2024-02-01' },
        { id: '4', name: 'Emily Wilson', role: 'Host', active: false, created_at: '2024-02-10' },
        { id: '5', name: 'David Brown', role: 'Bartender', active: true, created_at: '2024-02-15' }
      ];

      const mockShifts: LegacyShift[] = [
        { id: '1', staff_id: '1', start_time: '09:00', end_time: '17:00', area: 'Floor', staff_name: 'John Smith', staff_role: 'Manager' },
        { id: '2', staff_id: '2', start_time: '10:00', end_time: '18:00', area: 'Floor', staff_name: 'Sarah Johnson', staff_role: 'Server' },
        { id: '3', staff_id: '3', start_time: '08:00', end_time: '16:00', area: 'Kitchen', staff_name: 'Mike Davis', staff_role: 'Chef' },
        { id: '4', staff_id: '5', start_time: '16:00', end_time: '24:00', area: 'Bar', staff_name: 'David Brown', staff_role: 'Bartender' }
      ];

      setStaff(mockStaff);
      setShifts(mockShifts);
      
      const uniqueRoles = new Set(mockStaff.map(s => s.role)).size;
      setCounts({
        total_staff: mockStaff.length,
        active_staff: mockStaff.filter(s => s.active).length,
        unique_roles: uniqueRoles,
        active_shifts_count: mockShifts.length
      });
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleInviteStaff = () => {
    // Mock invite functionality
    console.log('Inviting new staff member...');
  };

  const handleExportStaff = () => {
    const csvData = staff.map(member => ({
      Name: member.name,
      Role: member.role,
      Status: member.active ? 'Active' : 'Inactive',
      'Join Date': member.created_at
    }));

    const csv = csvData.map(row => Object.values(row).join(',')).join('\n');
    const headers = Object.keys(csvData[0]).join(',');
    const fullCsv = headers + '\n' + csv;

    const blob = new Blob([fullCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${venueName}_staff_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getShiftsForDate = (date: string) => {
    return shifts.filter(shift => {
      // Mock filtering by date
      return true;
    });
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      'Manager': 'bg-blue-100 text-blue-800',
      'Server': 'bg-green-100 text-green-800',
      'Chef': 'bg-red-100 text-red-800',
      'Host': 'bg-purple-100 text-purple-800',
      'Bartender': 'bg-yellow-100 text-yellow-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading staff data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/${venueId}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={activeTab === 'staff' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('staff')}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            Staff
          </Button>
          <Button
            variant={activeTab === 'shifts' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('shifts')}
            className="flex items-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Shifts
          </Button>
          <Button
            variant={activeTab === 'reports' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('reports')}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Reports
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('settings')}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Total Staff</p>
                <p className="text-2xl font-bold text-gray-900">{counts.total_staff}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserPlus className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Active Staff</p>
                <p className="text-2xl font-bold text-gray-900">{counts.active_staff}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Roles</p>
                <p className="text-2xl font-bold text-gray-900">{counts.unique_roles}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Active Shifts</p>
                <p className="text-2xl font-bold text-gray-900">{counts.active_shifts_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'staff' | 'shifts' | 'reports' | 'settings')} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Staff Members
          </TabsTrigger>
          <TabsTrigger value="shifts" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Shift Schedule
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Staff Members</h2>
            <div className="flex items-center gap-2">
              <Button onClick={handleExportStaff} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={handleInviteStaff}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Staff
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((member) => (
              <Card key={member.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold">{member.name}</h3>
                        <Badge className={getRoleColor(member.role)}>
                          {member.role}
                        </Badge>
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={member.active}
                      onCheckedChange={(checked) => {
                        setStaff(prev => prev.map(s => 
                          s.id === member.id ? { ...s, active: checked } : s
                        ));
                      }}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Joined: {new Date(member.created_at).toLocaleDateString()}</p>
                    <p>Status: {member.active ? 'Active' : 'Inactive'}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="shifts" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Shift Schedule</h2>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Shift
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Today's Shifts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getShiftsForDate(selectedDate).map((shift) => (
                  <div key={shift.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div>
                        <h4 className="font-semibold">{shift.staff_name}</h4>
                        <p className="text-sm text-muted-foreground">{shift.staff_role}</p>
                      </div>
                      <Badge variant="outline">{shift.area}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{shift.start_time} - {shift.end_time}</p>
                      <p className="text-sm text-muted-foreground">
                        {isOvernight(shift.start_time, shift.end_time) ? 'Overnight' : 'Same Day'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <h2 className="text-xl font-semibold">Staff Reports</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Staff Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Average Hours per Week</span>
                    <span className="font-semibold">32.5</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Total Hours This Month</span>
                    <span className="font-semibold">520</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Overtime Hours</span>
                    <span className="font-semibold text-orange-600">12</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Role Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(new Set(staff.map(s => s.role))).map((role) => {
                    const count = staff.filter(s => s.role === role).length;
                    const percentage = (count / staff.length) * 100;
                    return (
                      <div key={role} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{role}</span>
                          <span>{count} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <h2 className="text-xl font-semibold">Staff Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Require Staff Login</span>
                  <ToggleSwitch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span>Auto-logout After Inactivity</span>
                  <ToggleSwitch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span>Email Notifications</span>
                  <ToggleSwitch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shift Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default Shift Length (hours)</label>
                  <Input type="number" defaultValue="8" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Break Duration (minutes)</label>
                  <Input type="number" defaultValue="30" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Allow Overnight Shifts</span>
                  <ToggleSwitch />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
