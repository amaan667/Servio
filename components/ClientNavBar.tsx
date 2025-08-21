"use client";

import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useAuth } from "@/app/authenticated-client-provider";

export default function ClientNavBar({ showActions = true, venueId }: { showActions?: boolean; venueId?: string }) {
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Use our central auth context
  const { session } = useAuth();

  useEffect(() => {
    const fetchPrimaryVenue = async () => {
      try {
        if (session?.user) {
          const supabase = supabaseBrowser();
          const { data, error } = await supabase
            .from('venues')
            .select('venue_id')
            .eq('owner_id', session.user.id)
            .order('created_at', { ascending: true })
            .limit(1);

          if (!error && data?.length) {
            setPrimaryVenueId(data[0].venue_id);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching primary venue:', err);
        setLoading(false);
      }
    };

    if (!venueId) {
      fetchPrimaryVenue();
    } else {
      setPrimaryVenueId(venueId);
      setLoading(false);
    }
  }, [venueId, session]);

  const resolvedVenueId = venueId ?? primaryVenueId;

  if (loading) {
    return (
      <nav className="flex items-center justify-between h-28 px-6 bg-white border-b shadow-lg sticky top-0 z-20">
        <div className="flex items-center">
          <div className="w-[200px] h-[50px] bg-gray-200 animate-pulse rounded"></div>
        </div>
      </nav>
    );
  }

  // Fallback to dashboard if no venueId is available
  const homeHref = resolvedVenueId ? `/dashboard/${resolvedVenueId}` : '/dashboard';
  const settingsHref = resolvedVenueId ? `/dashboard/${resolvedVenueId}/settings` : '/settings';

  console.log('[NAV] ClientNavBar', { venueId, resolvedVenueId, homeHref, settingsHref });

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
    } finally {
      window.location.href = '/sign-in';
    }
  };

  return (
    <nav className="flex items-center justify-between h-28 px-6 bg-white border-b shadow-lg sticky top-0 z-20">
      <div className="flex items-center">
        {/* [NAV] Use relative link to venue dashboard */}
        <Link href={homeHref} className="flex items-center">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio logo"
            width={200}
            height={50}
            priority
            className="hover:opacity-80 transition-opacity"
          />
        </Link>
      </div>
      <div className="flex items-center space-x-4">
        {/* [NAV] Home goes to venue dashboard */}
        <Link href={homeHref} className="text-gray-600 hover:text-gray-900 font-medium">Home</Link>
        {showActions && (
          <>
            <Link href={settingsHref} className="text-gray-600 hover:text-gray-900">
              <Button variant="outline" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
            {/* [NAV] Use client-side sign-out */}
            <Button variant="destructive" onClick={handleSignOut}>
              Sign Out
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
