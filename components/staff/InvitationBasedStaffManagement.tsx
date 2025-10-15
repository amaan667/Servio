'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Users, 
  Mail, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Crown,
  Shield,
  UserCheck,
  ChefHat,
  User,
  CreditCard,
  Calendar,
  Trash2,
  Edit
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TimeField24, { TimeValue24 } from '@/components/inputs/TimeField24';
import { buildIsoFromLocal, isOvernight, addDaysISO } from '@/lib/time';
import EnhancedShiftSchedule from '@/components/staff/EnhancedShiftSchedule';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string;
  invited_by_name: string;
}

interface LegacyShift {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  area?: string;
  staff_name: string;
  staff_role: string;
}

interface InvitationBasedStaffManagementProps {
  venueId: string;
  venueName: string;
}

const ROLES = [
  { id: 'owner', name: 'Owner', icon: Crown, color: 'bg-yellow-100 text-yellow-800 border-yellow-200', description: 'Full access to all features' },
  { id: 'manager', name: 'Manager', icon: Shield, color: 'bg-blue-100 text-blue-800 border-blue-200', description: 'Manage daily operations' },
  { id: 'staff', name: 'Staff', icon: UserCheck, color: 'bg-green-100 text-green-800 border-green-200', description: 'Handle orders and basic operations' },
  { id: 'kitchen', name: 'Kitchen', icon: ChefHat, color: 'bg-orange-100 text-orange-800 border-orange-200', description: 'Food preparation focus' },
  { id: 'server', name: 'Server', icon: User, color: 'bg-purple-100 text-purple-800 border-purple-200', description: 'Customer service' },
  { id: 'cashier', name: 'Cashier', icon: CreditCard, color: 'bg-indigo-100 text-indigo-800 border-indigo-200', description: 'Payment processing' },
];

export default function InvitationBasedStaffManagement({ 
  venueId, 
  venueName 
}: InvitationBasedStaffManagementProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [allShifts, setAllShifts] = useState<LegacyShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingShiftFor, setEditingShiftFor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('team');

  // Load staff and invitations
  useEffect(() => {
    loadData();
  }, [venueId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load staff members
      const staffResponse = await fetch(`/api/staff/check?venue_id=${encodeURIComponent(venueId)}`);
      const staffData = await staffResponse.json();
      
      if (staffResponse.ok) {
        setStaff(staffData.staff || []);
      }

      // Load invitations
      const invitationsResponse = await fetch(`/api/staff/invitations?venue_id=${encodeURIComponent(venueId)}`);
      const invitationsData = await invitationsResponse.json();
      
      if (invitationsResponse.ok) {
        setInvitations(invitationsData.invitations || []);
      }

      // Load shifts
      const shiftsResponse = await fetch(`/api/staff/shifts/list?venue_id=${encodeURIComponent(venueId)}`);
      const shiftsData = await shiftsResponse.json();
      
      if (shiftsResponse.ok) {
        setAllShifts(shiftsData.shifts || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  const reloadAllShifts = useCallback(async () => {
    try {
      const res = await fetch(`/api/staff/shifts/list?venue_id=${encodeURIComponent(venueId)}`);
      const j = await res.json().catch(() => ({}));
      if (res.ok && !j?.error) {
        const shifts = j.shifts || [];
        setAllShifts(shifts);
      }
    } catch (e) {
      console.error('Failed to load shifts:', e);
    }
  }, [venueId]);

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim()) {
      setError('Email is required');
      return;
    }

    setInviteLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/staff/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venue_id: venueId,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      // Show different messages based on email status
      if (data.emailSent) {
        toast({
          title: 'Invitation sent!',
          description: `An invitation has been sent to ${inviteEmail}`,
        });
      } else {
        toast({
          title: 'Invitation created!',
          description: `Invitation created but email failed to send. Check server logs for invitation link.`,
          variant: 'destructive',
        });
        console.log('📧 Invitation link:', data.invitationLink);
      }

      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('staff');
      
      // Switch to invitations tab and reload data
      setActiveTab('invitations');
      loadData(); // Reload to show new invitation
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };


  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      const response = await fetch('/api/staff/invitations/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: invitationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.migrationRequired) {
          toast({
            title: 'Database Migration Required',
            description: 'Please run the database migration to fix invitation cancellation. Contact your administrator.',
            variant: 'destructive',
          });
        }
        throw new Error(data.error || 'Failed to cancel invitation');
      }

      // Show appropriate message based on response
      if (data.fallback) {
        toast({
          title: 'Invitation cancelled',
          description: 'The invitation has been cancelled (marked as cancelled due to database constraint)',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Invitation cancelled',
          description: 'The invitation has been cancelled successfully',
        });
      }

      // Update the invitations list locally instead of reloading everything
      setInvitations(prevInvitations => 
        prevInvitations.filter(invitation => invitation.id !== invitationId)
      );

      // Reload only the invitations data to ensure consistency
      const invitationsResponse = await fetch(`/api/staff/invitations?venue_id=${encodeURIComponent(venueId)}`);
      const invitationsData = await invitationsResponse.json();
      
      if (invitationsResponse.ok) {
        setInvitations(invitationsData.invitations || []);
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to cancel invitation',
        variant: 'destructive',
      });
    }
  };

  const getRoleInfo = (roleId: string) => {
    return ROLES.find(role => role.id === roleId) || ROLES[2]; // Default to staff
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Shift management component
  const StaffRowItem = memo(function StaffRowItem({ 
    row, 
    onDeleteRow, 
    onShiftsChanged, 
    embedded = false, 
    onClose 
  }: { 
    row: StaffMember; 
    onDeleteRow: (r: StaffMember) => void; 
    onShiftsChanged: () => void; 
    embedded?: boolean; 
    onClose?: () => void; 
  }) {
    const [showEditor, setShowEditor] = useState(embedded);
    const [date, setDate] = useState('');
    const [start, setStart] = useState<TimeValue24>({ hour: null, minute: null });
    const [end, setEnd] = useState<TimeValue24>({ hour: null, minute: null });
    const [area, setArea] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [shifts, setShifts] = useState<LegacyShift[]>([]);

    const load = useCallback(async () => {
      try {
        const res = await fetch(`/api/staff/shifts/list?venue_id=${encodeURIComponent(venueId)}&staff_id=${encodeURIComponent(row.id)}`);
        const j = await res.json().catch(() => ({}));
        if (res.ok && !j?.error) {
          setShifts(j.shifts || []);
        }
      } catch (e) {
        console.error('Failed to load shifts:', e);
      }
    }, [row.id, venueId]);

    useEffect(() => { load(); }, [load]);

    const save = useCallback(async () => {
      setErr(null);
      if (!date || start.hour == null || start.minute == null || end.hour == null || end.minute == null) {
        setErr('Please select date, start and end time');
        return;
      }
      setSaving(true);
      const overnight = isOvernight(start.hour, start.minute, end.hour, end.minute);
      const startIso = buildIsoFromLocal(date, start.hour, start.minute);
      const endDate = overnight ? addDaysISO(date, 1) : date;
      const endIso = buildIsoFromLocal(endDate, end.hour, end.minute);
      const res = await fetch('/api/staff/shifts/add', { 
        method: 'POST', 
        headers: { 'content-type': 'application/json' }, 
        body: JSON.stringify({ 
          staff_id: row.id, 
          venue_id: venueId, 
          start_time: startIso, 
          end_time: endIso, 
          area: area || null 
        }) 
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.error) { 
        setErr(j?.error || 'Failed to save shift'); 
        setSaving(false); 
        return; 
      }
      setSaving(false);
      setArea('');
      setStart({ hour: null, minute: null });
      setEnd({ hour: null, minute: null });
      await load();
      onShiftsChanged();
      if (embedded && onClose) {
        onClose();
      }
    }, [area, date, end.hour, end.minute, load, onShiftsChanged, row.id, start.hour, start.minute, venueId, embedded, onClose]);

    return (
      <div className="rounded border p-3">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">Add Shift for {row.name}</h4>
          {embedded && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <TimeField24 value={start} onChange={setStart} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <TimeField24 value={end} onChange={setEnd} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Area (Optional)</label>
            <Input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Kitchen, Floor, etc."
              className="h-9"
            />
          </div>
        </div>

        {err && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{err}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 mb-3">
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Shift
          </Button>
        </div>

        {shifts.length > 0 && (
          <div className="border-t pt-3">
            <h5 className="font-medium mb-2">Recent Shifts</h5>
            <div className="space-y-2">
              {shifts.slice(0, 5).map((shift) => (
                <div key={shift.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                  <span>
                    {new Date(shift.start_time).toLocaleDateString()} - 
                    {new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to 
                    {new Date(shift.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {shift.area && ` (${shift.area})`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
          <p className="text-gray-600">Invite and manage your team members and their shifts</p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Invite Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your team at {venueName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="team@example.com"
                  className="h-11"
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  id="role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full h-11 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  {ROLES.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} - {role.description}
                    </option>
                  ))}
                </select>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={handleSendInvitation}
                  disabled={inviteLoading || !inviteEmail.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {inviteLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                  disabled={inviteLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Team Members</p>
                <p className="text-2xl font-bold text-gray-900">{staff.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Invitations</p>
                <p className="text-2xl font-bold text-gray-900">
                  {invitations.filter(inv => inv.status === 'pending').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Invitations</p>
                <p className="text-2xl font-bold text-gray-900">{invitations.length}</p>
              </div>
              <Mail className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="shifts">Shift Management</TabsTrigger>
          <TabsTrigger value="schedule">Schedule View</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          {staff.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No team members yet</h3>
                <p className="text-gray-600 mb-4">
                  Start building your team by inviting staff members.
                </p>
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Invite Your First Member
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {staff.map((member) => {
                const roleInfo = getRoleInfo(member.role);
                const IconComponent = roleInfo.icon;
                
                return (
                  <Card key={member.id}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                              <IconComponent className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{member.name}</p>
                              <p className="text-sm text-gray-600">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={roleInfo.color}>
                              {roleInfo.name}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingShiftFor(member.id)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Calendar className="h-4 w-4 mr-1" />
                              Manage Shifts
                            </Button>
                          </div>
                        </div>
                        
                        {/* Shift Editor */}
                        {editingShiftFor === member.id && (
                          <div className="mt-4">
                            <StaffRowItem 
                              row={member} 
                              onDeleteRow={() => {}} 
                              onShiftsChanged={reloadAllShifts}
                              embedded={true}
                              onClose={() => setEditingShiftFor(null)}
                            />
                          </div>
                        )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          {invitations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No invitations sent</h3>
                <p className="text-gray-600 mb-4">
                  Send invitations to add new team members.
                </p>
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Send First Invitation
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {invitations.filter(invitation => invitation.status === 'pending').map((invitation) => {
                const roleInfo = getRoleInfo(invitation.role);
                const IconComponent = roleInfo.icon;
                
                return (
                  <Card key={invitation.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <IconComponent className="h-5 w-5 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{invitation.email}</p>
                            <p className="text-sm text-gray-600">
                              Invited by {invitation.invited_by_name} • {new Date(invitation.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={roleInfo.color}>
                            {roleInfo.name}
                          </Badge>
                          <Badge className={getStatusColor(invitation.status)}>
                            {getStatusIcon(invitation.status)}
                            <span className="ml-1 capitalize">{invitation.status}</span>
                          </Badge>
                          {invitation.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelInvitation(invitation.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shifts" className="space-y-4">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Shift Management</h3>
                <p className="text-gray-600">Add and manage shifts for your staff members</p>
              </div>
            </div>
            
            {staff.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No staff members to manage shifts</h3>
                  <p className="text-gray-600 mb-4">
                    Add staff members first to manage their shifts.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {staff.map((member) => {
                  const roleInfo = getRoleInfo(member.role);
                  const IconComponent = roleInfo.icon;
                  
                  return (
                    <Card key={member.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                              <IconComponent className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{member.name}</p>
                              <p className="text-sm text-gray-600">{member.email}</p>
                            </div>
                          </div>
                          <Badge className={roleInfo.color}>
                            {roleInfo.name}
                          </Badge>
                        </div>
                        
                        <StaffRowItem 
                          row={member} 
                          onDeleteRow={() => {}} 
                          onShiftsChanged={reloadAllShifts}
                          embedded={false}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Schedule View</h3>
                <p className="text-gray-600">View and manage your team's schedule</p>
              </div>
            </div>
            
            <EnhancedShiftSchedule
              staff={staff}
              shifts={allShifts}
              venueId={venueId}
              onShiftAdded={reloadAllShifts}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
