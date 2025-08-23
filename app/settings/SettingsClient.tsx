"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import UniversalHeader from "@/components/UniversalHeader";
import { supabase } from "@/lib/sb-client";
import { ArrowLeft, Save, User, Building, Mail, Phone } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Venue {
  venue_id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
}

export default function SettingsClient({ user, venues }: { user: User; venues: Venue[] }) {
  const [loading, setLoading] = useState(false);
  const [venueForm, setVenueForm] = useState({
    name: venues[0]?.name || '',
    phone: '',
    address: ''
  });
  const [accountForm, setAccountForm] = useState({
    email: user.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const router = useRouter();

  const handleVenueUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (venues[0]) {
        const { error } = await supabase
          .from('venues')
          .update({
            name: venueForm.name,
            phone: venueForm.phone || null,
            address: venueForm.address || null
          })
          .eq('venue_id', venues[0].venue_id)
          .eq('owner_id', user.id);

        if (!error) {
          alert('Venue settings updated successfully!');
        } else {
          alert('Error updating venue settings');
        }
      }
    } catch (error) {
      alert('Error updating venue settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (accountForm.newPassword && accountForm.newPassword !== accountForm.confirmPassword) {
        alert('New passwords do not match');
        return;
      }

      if (accountForm.newPassword) {
        const { error } = await supabase.auth.updateUser({
          password: accountForm.newPassword
        });

        if (error) {
          alert('Error updating password');
        } else {
          alert('Password updated successfully!');
          setAccountForm(prev => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          }));
        }
      }
    } catch (error) {
      alert('Error updating account settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <UniversalHeader venueId={venues?.[0]?.venue_id} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="outline" 
            onClick={() => router.push(`/dashboard/${venues?.[0]?.venue_id}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account and venue settings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Venue Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="h-5 w-5 mr-2" />
                Venue Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVenueUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="venueName">Venue Name</Label>
                  <Input
                    id="venueName"
                    value={venueForm.name}
                    onChange={(e) => setVenueForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="venuePhone">Phone Number</Label>
                  <Input
                    id="venuePhone"
                    type="tel"
                    value={venueForm.phone}
                    onChange={(e) => setVenueForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+44 123 456 7890"
                  />
                </div>
                <div>
                  <Label htmlFor="venueAddress">Address</Label>
                  <Textarea
                    id="venueAddress"
                    value={venueForm.address}
                    onChange={(e) => setVenueForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter your venue address"
                    rows={3}
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Venue Settings'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAccountUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={accountForm.email}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-sm text-gray-500 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={accountForm.newPassword}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={accountForm.confirmPassword}
                    onChange={(e) => setAccountForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm new password"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Danger Zone */}
        <Card className="mt-8 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Delete Account</h4>
                <p className="text-sm text-gray-500">Permanently delete your account and all data</p>
              </div>
              <Button variant="destructive" size="sm">
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
