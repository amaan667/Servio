"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { useLocale } from "@/context/LocaleContext";

export function VenueLocaleSync({ venueId }: { venueId: string }) {
  const { setFromVenue } = useLocale();

  useEffect(() => {
    if (!venueId) return;
    const supabase = supabaseBrowser();
    supabase
      .from("venues")
      .select("country, currency, timezone")
      .eq("venue_id", venueId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setFromVenue(data);
      });
  }, [venueId, setFromVenue]);

  return null;
}
