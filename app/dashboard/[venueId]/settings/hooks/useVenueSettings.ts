import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { detectBrowserLocale, getLocaleForCountry, COUNTRY_OPTIONS } from "@/lib/locale";

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
  venue_id: string;
  venue_name: string;
  email?: string;
  phone?: string;
  address?: string;
  timezone?: string;
  currency?: string;
  country?: string | null;
  venue_type?: string;
  service_type?: string;
  operating_hours?: OperatingHours;
  latitude?: number;
  longitude?: number;
  notify_customer_on_ready?: boolean;
  updated_at?: string;
}

export interface User {
  id: string;
  email?: string;
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

export interface DayHours {
  open: string;
  close: string;
  closed: boolean;
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
  const [country, setCountry] = useState<string>(venue.country || "");
  const [timezone, setTimezone] = useState(venue.timezone || "Europe/London");
  const [currency, setCurrency] = useState((venue as { currency?: string }).currency || "GBP");
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

  // Notification settings state
  // Default to true for counter pickup venues, false otherwise
  const defaultNotifyOnReady =
    venue.service_type === "counter_pickup" || venue.service_type === "both";
  const [notifyCustomerOnReady, setNotifyCustomerOnReady] = useState(
    venue.notify_customer_on_ready ?? defaultNotifyOnReady
  );

  // Auto-detect locale (country, currency, timezone) on mount when not set
  useEffect(() => {
    if (venue.country && venue.timezone && (venue as { currency?: string }).currency) return;
    const detected = detectBrowserLocale();
    if (!venue.country) setCountry(detected.countryCode);
    if (!venue.timezone) setTimezone(detected.timezone);
    if (!(venue as { currency?: string }).currency) setCurrency(detected.currency);
  }, [venue.country, venue.timezone, (venue as { currency?: string }).currency]);

  // Sync state from venue when server data changes (e.g. after save + router.refresh)
  useEffect(() => {
    setVenueName(venue.venue_name);
    setVenueEmail(venue.email || "");
    setVenuePhone(venue.phone || "");
    setVenueAddress(venue.address || "");
    setCountry(venue.country || "");
    setTimezone(venue.timezone || "Europe/London");
    setCurrency((venue as { currency?: string }).currency || "GBP");
    setVenueType(venue.venue_type || "restaurant");
    setServiceType(venue.service_type || "table_service");
    setOperatingHours(venue.operating_hours || {});
    setLatitude(venue.latitude);
    setLongitude(venue.longitude);
    setAutoEmailReceipts((venue as { auto_email_receipts?: boolean }).auto_email_receipts ?? false);
    setShowVATBreakdown((venue as { show_vat_breakdown?: boolean }).show_vat_breakdown ?? true);
    setAllowEmailInput((venue as { allow_email_input?: boolean }).allow_email_input ?? true);
    setReceiptLogoUrl((venue as { receipt_logo_url?: string }).receipt_logo_url || "");
    setReceiptFooterText((venue as { receipt_footer_text?: string }).receipt_footer_text || "");
    setNotifyCustomerOnReady(
      venue.notify_customer_on_ready ??
        (venue.service_type === "counter_pickup" || venue.service_type === "both")
    );
  }, [venue.venue_id, venue.updated_at]);

  // Track unsaved changes
  useEffect(() => {
    const defaultNotify = venue.service_type === "counter_pickup" || venue.service_type === "both";
    const venueCurrency = (venue as { currency?: string }).currency || "GBP";
    const changed =
      venueName !== venue.venue_name ||
      venueEmail !== (venue.email || "") ||
      venuePhone !== (venue.phone || "") ||
      venueAddress !== (venue.address || "") ||
      country !== (venue.country || "") ||
      timezone !== (venue.timezone || "Europe/London") ||
      currency !== venueCurrency ||
      venueType !== (venue.venue_type || "restaurant") ||
      serviceType !== (venue.service_type || "table_service") ||
      autoEmailReceipts !==
        ((venue as { auto_email_receipts?: boolean }).auto_email_receipts ?? false) ||
      showVATBreakdown !==
        ((venue as { show_vat_breakdown?: boolean }).show_vat_breakdown ?? true) ||
      allowEmailInput !== ((venue as { allow_email_input?: boolean }).allow_email_input ?? true) ||
      receiptLogoUrl !== ((venue as { receipt_logo_url?: string }).receipt_logo_url || "") ||
      receiptFooterText !==
        ((venue as { receipt_footer_text?: string }).receipt_footer_text || "") ||
      notifyCustomerOnReady !== (venue.notify_customer_on_ready ?? defaultNotify);

    setHasUnsavedChanges(changed);
  }, [
    venueName,
    venueEmail,
    venuePhone,
    venueAddress,
    country,
    timezone,
    currency,
    venueType,
    serviceType,
    venue,
    autoEmailReceipts,
    showVATBreakdown,
    allowEmailInput,
    receiptLogoUrl,
    receiptFooterText,
    notifyCustomerOnReady,
  ]);

  const updateVenueSettings = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await createClient()
        .from("venues")
        .update({
          venue_name: venueName,
          email: venueEmail || null,
          phone: venuePhone || null,
          address: venueAddress || null,
          country: country || null,
          timezone,
          currency: currency || "GBP",
          venue_type: venueType,
          service_type: serviceType,
          operating_hours: Object.keys(operatingHours).length > 0 ? operatingHours : null,
          latitude: latitude || null,
          longitude: longitude || null,
          auto_email_receipts: autoEmailReceipts,
          show_vat_breakdown: showVATBreakdown,
          allow_email_input: allowEmailInput,
          receipt_logo_url: receiptLogoUrl || null,
          receipt_footer_text: receiptFooterText || null,
          notify_customer_on_ready: notifyCustomerOnReady,
          updated_at: new Date().toISOString(),
        })
        .eq("venue_id", venue.venue_id);

      if (error) {
        throw new Error(error.message);
      }

      setSuccess("✅ Venue settings updated successfully!");
      setHasUnsavedChanges(false);

      toast({
        title: "Success",
        description: "✅ Venue settings updated successfully!",
        duration: 3000,
      });

      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : "Failed to update venue settings");
      toast({
        title: "Error",
        description: _err instanceof Error ? _err.message : "Failed to update venue settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDayHours = (
    day: string,
    field: "open" | "close" | "closed",
    value: string | boolean
  ) => {
    setOperatingHours((prev) => ({
      ...prev,
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
    country,
    setCountry,
    timezone,
    setTimezone,
    currency,
    setCurrency,
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
    notifyCustomerOnReady,
    setNotifyCustomerOnReady,
    updateVenueSettings,
    updateDayHours,
    countryOptions: COUNTRY_OPTIONS,
    applyCountryLocale: (countryCode: string) => {
      const info = getLocaleForCountry(countryCode);
      if (info) {
        setCountry(info.countryCode);
        setCurrency(info.currency);
        setTimezone(info.timezone);
      }
    },
  };
}
