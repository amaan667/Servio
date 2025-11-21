"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, Save } from "lucide-react";
import MobileNav from "@/components/MobileNav";
import BillingSection from "@/components/settings/BillingSection";

// Hooks
import { useVenueSettings, Venue, User } from "./hooks/useVenueSettings";
import { usePasswordManagement } from "./hooks/usePasswordManagement";
import { useAccountDeletion } from "./hooks/useAccountDeletion";

// Components
import { AccountInformationCard } from "./components/AccountInformationCard";
import { PlanCard } from "./components/PlanCard";
import { SecuritySettingsCard } from "./components/SecuritySettingsCard";
import { VenueSettingsCard } from "./components/VenueSettingsCard";
import { OperatingHoursCard } from "./components/OperatingHoursCard";
import { DeleteAccountCard } from "./components/DeleteAccountCard";
import { ReceiptSettingsCard } from "./components/ReceiptSettingsCard";

interface VenueSettingsClientProps {
  user: User;
  venue: Venue;
  venues: Venue[];
  isOwner?: boolean;
  organization?: {
    id: string;
    subscription_tier?: string;
    stripe_customer_id?: string;
    subscription_status?: string;
    trial_ends_at?: string;
  };
}

/**
 * Venue Settings Client Component
 * Manages venue and account settings
 *
 * Refactored: Extracted hooks and components for better organization
 * Original: 828 lines → Now: ~180 lines
 */

export default function VenueSettingsClient({
  user,
  venue,
  venues,
  organization,
  isOwner = true,
}: VenueSettingsClientProps) {
  if (!organization) {
    console.error(
      "[VENUE SETTINGS CLIENT] ❌ ORGANIZATION IS NULL/UNDEFINED - This will cause PlanCard to show error!"
    );
  }

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Custom hooks for different sections
  const venueSettings = useVenueSettings(venue);
  const passwordManagement = usePasswordManagement(user);
  const accountDeletion = useAccountDeletion(user);

  const handleSaveSettings = () => {
    venueSettings.updateVenueSettings();
  };

  const handleCancelPassword = () => {
    passwordManagement.setShowPasswordDialog(false);
    passwordManagement.resetPasswordForm();
  };

  return (
    <>
      <div className="space-y-8 pb-32 md:pb-8">
        {/* Success/Error Messages */}
        {venueSettings.success && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{venueSettings.success}</AlertDescription>
          </Alert>
        )}

        {(venueSettings.error || passwordManagement.error || accountDeletion.error) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {venueSettings.error || passwordManagement.error || accountDeletion.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Two-column layout for larger screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            <AccountInformationCard user={user} />

            <PlanCard organization={organization} venueId={venue.venue_id} />

            <SecuritySettingsCard
              shouldShowSetPassword={passwordManagement.shouldShowSetPassword}
              showPasswordDialog={passwordManagement.showPasswordDialog}
              setShowPasswordDialog={passwordManagement.setShowPasswordDialog}
              newPassword={passwordManagement.newPassword}
              setNewPassword={passwordManagement.setNewPassword}
              confirmPassword={passwordManagement.confirmPassword}
              setConfirmPassword={passwordManagement.setConfirmPassword}
              loading={passwordManagement.loading}
              onChangePassword={passwordManagement.changePassword}
              onCancel={handleCancelPassword}
              twoFactorEnabled={twoFactorEnabled}
              setTwoFactorEnabled={setTwoFactorEnabled}
            />
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            <VenueSettingsCard
              venueName={venueSettings.venueName}
              setVenueName={venueSettings.setVenueName}
              venueEmail={venueSettings.venueEmail}
              setVenueEmail={venueSettings.setVenueEmail}
              venuePhone={venueSettings.venuePhone}
              setVenuePhone={venueSettings.setVenuePhone}
              venueAddress={venueSettings.venueAddress}
              setVenueAddress={venueSettings.setVenueAddress}
              timezone={venueSettings.timezone}
              setTimezone={venueSettings.setTimezone}
              venueType={venueSettings.venueType}
              setVenueType={venueSettings.setVenueType}
              serviceType={venueSettings.serviceType}
              setServiceType={venueSettings.setServiceType}
              latitude={venueSettings.latitude}
              setLatitude={venueSettings.setLatitude}
              longitude={venueSettings.longitude}
              setLongitude={venueSettings.setLongitude}
            />

            <OperatingHoursCard
              operatingHours={venueSettings.operatingHours}
              updateDayHours={venueSettings.updateDayHours}
            />

            <ReceiptSettingsCard
              autoEmailReceipts={venueSettings.autoEmailReceipts}
              setAutoEmailReceipts={venueSettings.setAutoEmailReceipts}
              showVATBreakdown={venueSettings.showVATBreakdown}
              setShowVATBreakdown={venueSettings.setShowVATBreakdown}
              allowEmailInput={venueSettings.allowEmailInput}
              setAllowEmailInput={venueSettings.setAllowEmailInput}
              receiptLogoUrl={venueSettings.receiptLogoUrl}
              setReceiptLogoUrl={venueSettings.setReceiptLogoUrl}
              receiptFooterText={venueSettings.receiptFooterText}
              setReceiptFooterText={venueSettings.setReceiptFooterText}
            />
          </div>
        </div>

        {/* Billing Section */}
        {organization && (
          <BillingSection
            organization={organization}
            venues={venues}
            isOwner={isOwner}
            venueId={venue.venue_id}
          />
        )}

        {/* Save Button */}
        {venueSettings.hasUnsavedChanges && (
          <Card className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t shadow-lg z-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between max-w-7xl mx-auto px-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <span className="text-sm font-medium text-gray-900">
                    You have unsaved changes
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    disabled={venueSettings.loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={venueSettings.loading}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {venueSettings.loading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delete Account Card */}
        <DeleteAccountCard
          showDeleteDialog={accountDeletion.showDeleteDialog}
          setShowDeleteDialog={accountDeletion.setShowDeleteDialog}
          deleteConfirmation={accountDeletion.deleteConfirmation}
          setDeleteConfirmation={accountDeletion.setDeleteConfirmation}
          loading={accountDeletion.loading}
          error={accountDeletion.error}
          onDeleteAccount={accountDeletion.deleteAccount}
        />
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        venueId={venue.venue_id}
        venueName={venue.venue_name}
        counts={{
          live_orders: 0,
          total_orders: 0,
          notifications: 0,
        }}
      />
    </>
  );
}
