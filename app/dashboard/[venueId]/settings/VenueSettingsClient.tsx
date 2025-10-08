"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { User, Building, Mail, Phone, MapPin, Lock, Trash2, Save, Store, Shield, AlertTriangle, Clock, Globe, Utensils, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import MobileNav from '@/components/MobileNav';
import { AddressInput } from '@/components/settings/AddressInput';

interface Venue {
  venue_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  timezone?: string;
  venue_type?: string;
  service_type?: string;
  operating_hours?: OperatingHours;
  latitude?: number;
  longitude?: number;
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

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

interface OperatingHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

const TIMEZONES = [
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET)' },
  { value: 'Europe/Rome', label: 'Rome (CET)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Chicago', label: 'Chicago (CST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

const VENUE_TYPES = [
  { value: 'cafe', label: 'Café' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'dessert_lounge', label: 'Dessert Lounge' },
  { value: 'food_truck', label: 'Food Truck' },
  { value: 'bar_pub', label: 'Bar / Pub' },
  { value: 'other', label: 'Other' },
];

const SERVICE_TYPES = [
  { value: 'table_service', label: 'Table Service' },
  { value: 'counter_pickup', label: 'Pickup / Counter Orders' },
  { value: 'both', label: 'Both' },
];

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function VenueSettingsClient({ user, venue, venues }: VenueSettingsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Venue settings state
  const [venueName, setVenueName] = useState(venue.name);
  const [venueEmail, setVenueEmail] = useState(venue.email || '');
  const [venuePhone, setVenuePhone] = useState(venue.phone || '');
  const [venueAddress, setVenueAddress] = useState(venue.address || '');
  const [timezone, setTimezone] = useState(venue.timezone || 'Europe/London');
  const [venueType, setVenueType] = useState(venue.venue_type || 'restaurant');
  const [serviceType, setServiceType] = useState(venue.service_type || 'table_service');
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(venue.operating_hours || {});
  const [showOperatingHours, setShowOperatingHours] = useState(false);
  const [latitude, setLatitude] = useState<number | undefined>(venue.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(venue.longitude);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  
  // Account deletion state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // 2FA state (future-proofing)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Auto-detect timezone on mount
  useEffect(() => {
    if (!venue.timezone) {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const matchingTimezone = TIMEZONES.find(tz => tz.value === detectedTimezone);
      if (matchingTimezone) {
        setTimezone(detectedTimezone);
      }
    }
  }, [venue.timezone]);

  // Track unsaved changes
  useEffect(() => {
    const changed = 
      venueName !== venue.name ||
      venueEmail !== (venue.email || '') ||
      venuePhone !== (venue.phone || '') ||
      venueAddress !== (venue.address || '') ||
      timezone !== (venue.timezone || 'Europe/London') ||
      venueType !== (venue.venue_type || 'restaurant') ||
      serviceType !== (venue.service_type || 'table_service');
    
    setHasUnsavedChanges(changed);
  }, [venueName, venueEmail, venuePhone, venueAddress, timezone, venueType, serviceType, venue]);

  // Check if user signed up with OAuth (Google)
  const hasGoogleIdentity = user?.identities?.some((identity) => 
    identity.provider === 'google' || identity.provider === 'oauth'
  ) || false;
  
  const hasGoogleProvider = user?.app_metadata?.providers?.includes('google') || 
                           user?.app_metadata?.provider === 'google' || false;
  
  const isOAuthUser = hasGoogleIdentity || hasGoogleProvider;
  const hasPasswordSet = user?.user_metadata?.hasPasswordSet === true;
  const isGmailUser = user?.email?.endsWith('@gmail.com') || false;
  const isLikelyOAuthUser = isOAuthUser || (isGmailUser && !hasPasswordSet);
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
          timezone: timezone,
          venue_type: venueType,
          service_type: serviceType,
          operating_hours: Object.keys(operatingHours).length > 0 ? operatingHours : null,
          latitude: latitude || null,
          longitude: longitude || null,
          updated_at: new Date().toISOString()
        })
        .eq('venue_id', venue.venue_id);

      if (error) {
        throw new Error(error.message);
      }

      setSuccess('✅ Venue settings updated successfully!');
      setHasUnsavedChanges(false);
      
      toast({
        title: "Success",
        description: "✅ Venue settings updated successfully!",
        duration: 3000,
      });

      // Refresh the page after a short delay to reflect changes
      setTimeout(() => {
        router.refresh();
      }, 1500);
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
      const { error } = await createClient().auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw new Error(error.message);
      }

      if (shouldShowSetPassword) {
        const { error: metadataError } = await createClient().auth.updateUser({
          data: { hasPasswordSet: true }
        });
        
        if (metadataError) {
          console.error('Error updating password metadata:', metadataError);
        }
      }

      const successMessage = shouldShowSetPassword 
        ? 'Password set successfully! You can now sign in with email and password.' 
        : 'Password updated successfully!';
      
      setSuccess(successMessage);
      
      toast({
        title: "Success",
        description: successMessage,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        setShowPasswordDialog(false);
        setSuccess(null);
      }, 2000);

      if (shouldShowSetPassword) {
        setTimeout(() => {
          window.location.reload();
        }, 2500);
      }
      
    } catch (err: any) {
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
      const { error: venueError } = await createClient()
        .from('venues')
        .delete()
        .eq('owner_id', user.id);

      if (venueError) {
        console.error('Error deleting venues:', venueError);
      }

      const { error } = await createClient().auth.admin.deleteUser(user.id);

      if (error) {
        throw new Error(error.message);
      }

      try {
        const response = await fetch('/api/auth/signout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Sign out error:', error);
      }
      
      try {
        const { clearAuthStorage } = await import('@/lib/sb-client');
        clearAuthStorage();
      } catch (error) {
        console.error('Clear storage error:', error);
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

  const updateDayHours = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day as keyof OperatingHours],
        [field]: value
      } as DayHours
    }));
  };

  return (
    <>
      <div className="space-y-8 pb-32 md:pb-8">
        {/* Success/Error Messages */}
        {success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}
        
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Two-column layout for larger screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* Account Information */}
            <Card className="shadow-lg rounded-xl border-gray-200">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <User className="h-5 w-5 text-purple-600" />
                  Account Information
                </CardTitle>
                <CardDescription>Your personal account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email}
                    disabled
                    className="bg-gray-50 border-gray-200 rounded-lg mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">Email address cannot be changed - it's associated with your Gmail account</p>
                </div>
                
                <div>
                  <Label htmlFor="fullName" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    value={user.user_metadata?.full_name || ''}
                    disabled
                    className="bg-gray-50 border-gray-200 rounded-lg mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card className="shadow-lg rounded-xl border-gray-200">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Security Settings
                </CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full space-y-3">
                  <AccordionItem value="password">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        {shouldShowSetPassword ? 'Set Password' : 'Change Password'}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <p className="text-sm text-muted-foreground">
                          {shouldShowSetPassword 
                            ? 'Set a password so you can also sign in with your email and password'
                            : 'Update your account password'
                          }
                        </p>
                        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full rounded-lg">
                              {shouldShowSetPassword ? 'Set Password' : 'Change Password'}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-xl">
                            <DialogHeader>
                              <DialogTitle>{shouldShowSetPassword ? 'Set Password' : 'Change Password'}</DialogTitle>
                              <DialogDescription>
                                {shouldShowSetPassword 
                                  ? 'Create a password for your account so you can sign in with email and password in the future.'
                                  : 'Enter your new password below.'
                                }
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="newPassword">{shouldShowSetPassword ? 'Password' : 'New Password'}</Label>
                                <Input
                                  id="newPassword"
                                  type="password"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  placeholder={shouldShowSetPassword ? 'Create a password' : 'Enter new password'}
                                  disabled={loading}
                                  className="rounded-lg"
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
                                  className="rounded-lg"
                                />
                              </div>
                              
                              <div className="flex gap-2">
                                <Button 
                                  onClick={changePassword} 
                                  disabled={loading || !newPassword || !confirmPassword}
                                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
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
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="2fa" className="mt-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Two-Factor Authentication
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <p className="text-sm text-muted-foreground">
                          Add an extra layer of security to your account (Coming Soon)
                        </p>
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm">Enable 2FA</p>
                            <p className="text-xs text-muted-foreground">This feature will be available soon</p>
                          </div>
                          <Switch 
                            checked={twoFactorEnabled} 
                            onCheckedChange={setTwoFactorEnabled}
                            disabled
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* Venue Settings */}
            <Card className="shadow-lg rounded-xl border-gray-200">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <Store className="h-5 w-5 text-purple-600" />
                  Venue Settings
                </CardTitle>
                <CardDescription>Configure your venue details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <Label htmlFor="venueName" className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Venue Name *
                  </Label>
                  <Input
                    id="venueName"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    placeholder="Enter venue name"
                    className="rounded-lg border-gray-200 mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="venueType" className="flex items-center gap-2">
                    <Utensils className="h-4 w-4" />
                    Venue Type
                  </Label>
                  <Select value={venueType} onValueChange={setVenueType}>
                    <SelectTrigger className="rounded-lg border-gray-200 mt-1">
                      <SelectValue placeholder="Select venue type" />
                    </SelectTrigger>
                    <SelectContent>
                      {VENUE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="serviceType" className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    Type of Service
                  </Label>
                  <RadioGroup value={serviceType} onValueChange={setServiceType} className="mt-2 space-y-2">
                    {SERVICE_TYPES.map(service => (
                      <div key={service.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={service.value} id={service.value} />
                        <Label htmlFor={service.value} className="font-normal cursor-pointer">
                          {service.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="timezone" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Timezone
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="rounded-lg border-gray-200 mt-1">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Auto-detected from your browser</p>
                </div>

                <div>
                  <Label htmlFor="venueEmail" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Venue Email
                  </Label>
                  <Input
                    id="venueEmail"
                    type="email"
                    value={venueEmail}
                    onChange={(e) => setVenueEmail(e.target.value)}
                    placeholder="venue@example.com"
                    className="rounded-lg border-gray-200 mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="venuePhone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Venue Phone
                  </Label>
                  <Input
                    id="venuePhone"
                    value={venuePhone}
                    onChange={(e) => setVenuePhone(e.target.value)}
                    placeholder="+44 123 456 7890"
                    className="rounded-lg border-gray-200 mt-1"
                  />
                </div>
                
                <AddressInput
                  value={venueAddress}
                  onChange={(address) => setVenueAddress(address)}
                  onCoordinatesChange={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                />

                {/* Operating Hours - Expandable */}
                <Accordion type="single" collapsible className="border rounded-lg">
                  <AccordionItem value="hours" className="border-none">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Operating Hours (Optional)
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-3">
                        {DAYS_OF_WEEK.map(day => (
                          <div key={day} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-24 font-medium text-sm capitalize">{day}</div>
                            <div className="flex-1 flex items-center gap-2">
                              <Input
                                type="time"
                                value={operatingHours[day as keyof OperatingHours]?.open || '09:00'}
                                onChange={(e) => updateDayHours(day, 'open', e.target.value)}
                                disabled={operatingHours[day as keyof OperatingHours]?.closed}
                                className="rounded-lg text-sm"
                              />
                              <span className="text-sm">to</span>
                              <Input
                                type="time"
                                value={operatingHours[day as keyof OperatingHours]?.close || '17:00'}
                                onChange={(e) => updateDayHours(day, 'close', e.target.value)}
                                disabled={operatingHours[day as keyof OperatingHours]?.closed}
                                className="rounded-lg text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`${day}-closed`} className="text-sm cursor-pointer">Closed</Label>
                              <Switch
                                id={`${day}-closed`}
                                checked={operatingHours[day as keyof OperatingHours]?.closed || false}
                                onCheckedChange={(checked) => updateDayHours(day, 'closed', checked)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Danger Zone - Full Width */}
        <Card className="shadow-lg rounded-xl border-red-200">
          <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 rounded-t-xl">
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Irreversible account actions</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. This will permanently delete your account and all associated data including venues, orders, and menu items.
              </p>
              
              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full md:w-auto rounded-lg">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-xl">
                  <DialogHeader>
                    <DialogTitle className="text-red-600">Delete Account</DialogTitle>
                    <DialogDescription>
                      This will permanently delete your venue and all associated data.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Alert variant="destructive" className="border-red-200">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        This action cannot be undone. All your data will be permanently deleted.
                      </AlertDescription>
                    </Alert>
                    
                    <div>
                      <Label htmlFor="deleteConfirmation" className="font-medium">
                        Type <span className="font-bold text-red-600">DELETE</span> to confirm
                      </Label>
                      <Input
                        id="deleteConfirmation"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder="DELETE"
                        className="mt-2 rounded-lg"
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
                        onClick={() => {
                          setShowDeleteDialog(false);
                          setDeleteConfirmation('');
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sticky Save Button - Bottom Right */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 right-6 z-50 hidden md:block">
          <Button 
            onClick={updateVenueSettings} 
            disabled={loading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-2xl rounded-xl px-6 py-6 text-lg"
            size="lg"
          >
            <Save className="h-5 w-5 mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}

      {/* Mobile Save Button */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background border-t md:hidden z-50">
          <Button 
            onClick={updateVenueSettings} 
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl py-6"
            size="lg"
          >
            <Save className="h-5 w-5 mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}

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
    </>
  );
}
