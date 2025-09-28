"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { User, Building, Mail, Phone, MapPin, Lock, Trash2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import MobileNav from '@/components/MobileNav';

interface Venue {
  venue_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface User {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    hasPasswordSet?: boolean;
  };
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  identities?: Array<{
    provider: string;
    id: string;
  }>;
}

interface VenueSettingsClientProps {
  user: User;
  venue: Venue;
  venues: Venue[];
}

export default function VenueSettingsClient({ user, venue, venues }: VenueSettingsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Venue settings state
  const [venueName, setVenueName] = useState(venue.name);
  const [venueEmail, setVenueEmail] = useState(venue.email || '');
  const [venuePhone, setVenuePhone] = useState(venue.phone || '');
  const [venueAddress, setVenueAddress] = useState(venue.address || '');
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  
  // Account deletion state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Check if user signed up with OAuth (Google) using multiple methods
  const hasGoogleIdentity = user?.identities?.some((identity) => 
    identity.provider === 'google' || identity.provider === 'oauth'
  ) || false;
  
  const hasGoogleProvider = user?.app_metadata?.providers?.includes('google') || 
                           user?.app_metadata?.provider === 'google' || false;
  
  // OAuth user if they have Google identity or provider info
  const isOAuthUser = hasGoogleIdentity || hasGoogleProvider;

  // Check if user has set a password (tracked in user metadata)
  const hasPasswordSet = user?.user_metadata?.hasPasswordSet === true;
  
  // Fallback: If we can't detect OAuth but user doesn't have hasPasswordSet flag,
  // and they have a Gmail address, assume they're an OAuth user
  const isGmailUser = user?.email?.endsWith('@gmail.com') || false;
  const isLikelyOAuthUser = isOAuthUser || (isGmailUser && !hasPasswordSet);
  
  // Debug logging removed for performance
  
  // Determine if we should show "Set Password" or "Change Password"
  // Show "Set Password" only for OAuth users who haven't set a password yet
  // Show "Change Password" for all other cases (OAuth users with password set, or form signup users)
  const shouldShowSetPassword = isLikelyOAuthUser && !hasPasswordSet;

  const updateVenueSettings = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await createClient()
        .from('venues')
        .update({
          name: venueName,
          email: venueEmail || null,
          phone: venuePhone || null,
          address: venueAddress || null,
          updated_at: new Date().toISOString()
        })
        .eq('venue_id', venue.venue_id);

      if (error) {
        throw new Error(error.message);
      }

      setSuccess('Venue settings updated successfully!');
      toast({
        title: "Success",
        description: "Venue settings updated successfully!",
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update venue settings');
      toast({
        title: "Error",
        description: err.message || 'Failed to update venue settings',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      
      // Update password
      const { error } = await createClient().auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('[AUTH DEBUG] Password update error:', error);
        throw new Error(error.message);
      }


      // If this is an OAuth user setting their first password, mark it in metadata
      if (shouldShowSetPassword) {
        const { error: metadataError } = await createClient().auth.updateUser({
          data: { hasPasswordSet: true }
        });
        
        if (metadataError) {
          console.error('[AUTH DEBUG] Error updating password metadata:', metadataError);
        } else {
        }
      }

      const successMessage = shouldShowSetPassword 
        ? 'Password set successfully! You can now sign in with email and password.' 
        : 'Password updated successfully!';
      
      // Show success message first
      setSuccess(successMessage);
      
      toast({
        title: "Success",
        description: successMessage,
      });

      // Clear form fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Close dialog after a short delay to show success message
      setTimeout(() => {
        setShowPasswordDialog(false);
        setSuccess(null); // Clear success message when dialog closes
      }, 2000);

      // If this was setting a password for the first time, refresh the page
      if (shouldShowSetPassword) {
        setTimeout(() => {
          window.location.reload();
        }, 2500);
      }
      
    } catch (err: any) {
      console.error('[AUTH DEBUG] Password change failed:', err);
      setError(err.message || 'Failed to update password');
      toast({
        title: "Error",
        description: err.message || 'Failed to update password',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First delete all user's venues
      const { error: venueError } = await createClient()
        .from('venues')
        .delete()
        .eq('owner_id', user.id);

      if (venueError) {
        console.error('Error deleting venues:', venueError);
      }

      // Then delete the user account
      const { error } = await createClient().auth.admin.deleteUser(user.id);

      if (error) {
        throw new Error(error.message);
      }

      // Sign out and redirect to home
      try {
        // Use server-side sign out to avoid cookie modification errors
        const response = await fetch('/api/auth/signout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
        } else {
        }
      } catch (error) {
      }
      
      // Clear client-side storage
      try {
        const { clearAuthStorage } = await import('@/lib/sb-client');
        clearAuthStorage();
      } catch (error) {
      }
      
      router.push('/');
      
      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted.",
      });
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      toast({
        title: "Error",
        description: err.message || 'Failed to delete account',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="bg-gray-50"
            />
            <p className="text-sm text-gray-700 mt-1 font-medium">Email address cannot be changed</p>
          </div>
          
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={user.user_metadata?.full_name || ''}
              disabled
              className="bg-gray-50"
            />
          </div>
        </CardContent>
      </Card>

      {/* Venue Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Venue Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="venueName">Venue Name *</Label>
            <Input
              id="venueName"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="Enter venue name"
            />
          </div>
          
          <div>
            <Label htmlFor="venueEmail">Venue Email</Label>
            <Input
              id="venueEmail"
              type="email"
              value={venueEmail}
              onChange={(e) => setVenueEmail(e.target.value)}
              placeholder="venue@example.com"
            />
          </div>
          
          <div>
            <Label htmlFor="venuePhone">Venue Phone</Label>
            <Input
              id="venuePhone"
              value={venuePhone}
              onChange={(e) => setVenuePhone(e.target.value)}
              placeholder="+44 123 456 7890"
            />
          </div>
          
          <div>
            <Label htmlFor="venueAddress">Venue Address</Label>
            <Textarea
              id="venueAddress"
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="Enter venue address"
              rows={3}
            />
          </div>
          
          <Button 
            onClick={updateVenueSettings} 
            disabled={loading}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Updating...' : 'Update Venue Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Password Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {shouldShowSetPassword ? 'Set Password' : 'Change Password'}
          </CardTitle>
          <CardDescription className="text-gray-700 font-medium">
            {shouldShowSetPassword 
              ? 'Set a password so you can also sign in with your email and password'
              : 'Update your account password'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                {shouldShowSetPassword ? 'Set Password' : 'Change Password'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{shouldShowSetPassword ? 'Set Password' : 'Change Password'}</DialogTitle>
                <DialogDescription className="text-gray-700 font-medium">
                  {shouldShowSetPassword 
                    ? 'Create a password for your account so you can sign in with email and password in the future.'
                    : 'Enter your new password below.'
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Success/Error Messages */}
                {success && (
                  <Alert>
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}
                
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="newPassword">{shouldShowSetPassword ? 'Password' : 'New Password'}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={shouldShowSetPassword ? 'Create a password' : 'Enter new password'}
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <Label htmlFor="confirmPassword">{shouldShowSetPassword ? 'Confirm Password' : 'Confirm New Password'}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={shouldShowSetPassword ? 'Confirm your password' : 'Confirm new password'}
                    disabled={loading}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={changePassword} 
                    disabled={loading || !newPassword || !confirmPassword}
                    className="flex-1"
                  >
                    {loading ? (shouldShowSetPassword ? 'Setting...' : 'Updating...') : (shouldShowSetPassword ? 'Set Password' : 'Update Password')}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowPasswordDialog(false);
                      setError(null);
                      setSuccess(null);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    disabled={loading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 mb-4 font-medium">
            This action cannot be undone. This will permanently delete your account and all associated data.
          </p>
          
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                Delete Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-700 font-medium">
                  This action cannot be undone. This will permanently delete your account and all associated data.
                </p>
                
                <div>
                  <Label htmlFor="deleteConfirmation">
                    Type DELETE to confirm
                  </Label>
                  <Input
                    id="deleteConfirmation"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={deleteAccount} 
                    disabled={loading || deleteConfirmation !== 'DELETE'}
                    variant="destructive"
                    className="flex-1"
                  >
                    {loading ? 'Deleting...' : 'Permanently Delete Account'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDeleteDialog(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      
      {/* Mobile Navigation */}
      <MobileNav 
        venueId={venue.venue_id}
        venueName={venue.name}
        counts={{
          live_orders: 0,
          total_orders: 0,
          notifications: 0
        }}
      />
    </div>
  );
}
