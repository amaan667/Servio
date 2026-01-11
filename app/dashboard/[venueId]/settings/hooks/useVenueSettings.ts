import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { TIMEZONES } from "../constants";

export const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export interface Venue {

}

export interface User {

  };
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  identities?: Array<{

  }>;
}

export interface DayHours {

}

export interface OperatingHours {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
}

export function useVenueSettings(venue: Venue) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Venue settings state
  const [venueName, setVenueName] = useState(venue.venue_name);
  const [venueEmail, setVenueEmail] = useState(venue.email || "");
  const [venuePhone, setVenuePhone] = useState(venue.phone || "");
  const [venueAddress, setVenueAddress] = useState(venue.address || "");
  const [timezone, setTimezone] = useState(venue.timezone || "Europe/London");
  const [venueType, setVenueType] = useState(venue.venue_type || "restaurant");
  const [serviceType, setServiceType] = useState(venue.service_type || "table_service");
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(
    venue.operating_hours ||
      {
        /* Empty */
      }
  );
  const [latitude, setLatitude] = useState<number | undefined>(venue.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(venue.longitude);

  // Receipt settings state
  const [autoEmailReceipts, setAutoEmailReceipts] = useState(
    (venue as { auto_email_receipts?: boolean }).auto_email_receipts ?? false
  );
  const [showVATBreakdown, setShowVATBreakdown] = useState(
    (venue as { show_vat_breakdown?: boolean }).show_vat_breakdown ?? true
  );
  const [allowEmailInput, setAllowEmailInput] = useState(
    (venue as { allow_email_input?: boolean }).allow_email_input ?? true
  );
  const [receiptLogoUrl, setReceiptLogoUrl] = useState(
    (venue as { receipt_logo_url?: string }).receipt_logo_url || ""
  );
  const [receiptFooterText, setReceiptFooterText] = useState(
    (venue as { receipt_footer_text?: string }).receipt_footer_text || ""
  );

  // Auto-detect timezone on mount
  useEffect(() => {
    if (!venue.timezone) {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const matchingTimezone = TIMEZONES.find((tz) => tz.value === detectedTimezone);
      if (matchingTimezone) {
        setTimezone(detectedTimezone);
      }
    }
  }, [venue.timezone]);

  // Track unsaved changes
  useEffect(() => {
    const changed =
      venueName !== venue.venue_name ||
      venueEmail !== (venue.email || "") ||
      venuePhone !== (venue.phone || "") ||
      venueAddress !== (venue.address || "") ||
      timezone !== (venue.timezone || "Europe/London") ||
      venueType !== (venue.venue_type || "restaurant") ||
      serviceType !== (venue.service_type || "table_service") ||
      autoEmailReceipts !==
        ((venue as { auto_email_receipts?: boolean }).auto_email_receipts ?? false) ||
      showVATBreakdown !==
        ((venue as { show_vat_breakdown?: boolean }).show_vat_breakdown ?? true) ||
      allowEmailInput !== ((venue as { allow_email_input?: boolean }).allow_email_input ?? true) ||
      receiptLogoUrl !== ((venue as { receipt_logo_url?: string }).receipt_logo_url || "") ||
      receiptFooterText !== ((venue as { receipt_footer_text?: string }).receipt_footer_text || "");

    setHasUnsavedChanges(changed);
  }, [
    venueName,
    venueEmail,
    venuePhone,
    venueAddress,
    timezone,
    venueType,
    serviceType,
    venue,
    autoEmailReceipts,
    showVATBreakdown,
    allowEmailInput,
    receiptLogoUrl,
    receiptFooterText,
  ]);

  const updateVenueSettings = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await createClient()
        .from("venues")
        .update({

        .eq("venue_id", venue.venue_id);

      if (error) {
        throw new Error(error.message);
      }

      setSuccess("✅ Venue settings updated successfully!");
      setHasUnsavedChanges(false);

      toast({

      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to update venue settings");
      toast({

    } finally {
      setLoading(false);
    }
  };

  const updateDayHours = (

      [day]: {
        ...prev[day as keyof OperatingHours],
        [field]: value,
      } as DayHours,
    }));
  };

  return {
    loading,
    error,
    success,
    hasUnsavedChanges,
    venueName,
    setVenueName,
    venueEmail,
    setVenueEmail,
    venuePhone,
    setVenuePhone,
    venueAddress,
    setVenueAddress,
    timezone,
    setTimezone,
    venueType,
    setVenueType,
    serviceType,
    setServiceType,
    operatingHours,
    setOperatingHours,
    latitude,
    setLatitude,
    longitude,
    setLongitude,
    autoEmailReceipts,
    setAutoEmailReceipts,
    showVATBreakdown,
    setShowVATBreakdown,
    allowEmailInput,
    setAllowEmailInput,
    receiptLogoUrl,
    setReceiptLogoUrl,
    receiptFooterText,
    setReceiptFooterText,
    updateVenueSettings,
    updateDayHours,
  };
}
