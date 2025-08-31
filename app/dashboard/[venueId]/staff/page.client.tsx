'use client';

import { useState, useEffect } from 'react';
import { useAuth } from "@/app/auth/AuthProvider";
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit } from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function StaffPageClient({ venueId }: { venueId: string }) {
  const { session } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', role: 'server' });
  const [isAdding, setIsAdding] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (session?.user) {
      fetchStaff();
    }
  }, [session, venueId]);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase()
        .from('staff')
        .select('*')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching staff:', error);
      } else {
        setStaff(data || []);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const addStaffMember = async () => {
    if (!newStaff.name || !newStaff.email) return;

    setIsAdding(true);
    try {
      const { data, error } = await supabase()
        .from('staff')
        .insert({
          venue_id: venueId,
          name: newStaff.name,
          email: newStaff.email,
          role: newStaff.role,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding staff member:', error);
      } else {
        setStaff([data, ...staff]);
        setNewStaff({ name: '', email: '', role: 'server' });
      }
    } catch (error) {
      console.error('Error adding staff member:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const removeStaffMember = async (staffId: string) => {
    try {
      const { error } = await supabase()
        .from('staff')
        .delete()
        .eq('id', staffId);

      if (error) {
        console.error('Error removing staff member:', error);
      } else {
        setStaff(staff.filter(s => s.id !== staffId));
      }
    } catch (error) {
      console.error('Error removing staff member:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Staff Member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  placeholder="Staff member name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  placeholder="staff@example.com"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="server">Server</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={addStaffMember} disabled={isAdding}>
                Add Staff Member
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {staff.map((member) => (
          <Card key={member.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">{member.name}</h3>
                  <p className="text-sm text-gray-600">{member.email}</p>
                  <Badge variant="secondary" className="mt-1">
                    {member.role}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeStaffMember(member.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {staff.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">No staff members added yet.</p>
            <Button onClick={() => setIsAdding(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Staff Member
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}



