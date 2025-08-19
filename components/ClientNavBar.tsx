"use client";

import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/sb-client";
import { useAuth } from "@/app/authenticated-client-provider";

export default function ClientNavBar({ showActions = true, venueId }: { showActions?: boolean; venueId?: string }) {
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Use our central auth context
  const { user } = useAuth();

  useEffect(() => {
    const fetchPrimaryVenue = async () => {
      try {
        if (user) {
          const { data, error } = await supabase
            .from('venues')
            .select('venue_id')
            .eq('owner_id', user.id)
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
  }, [venueId]);

  const resolvedVenueId = venueId ?? primaryVenueId;
  const homeHref = resolvedVenueId ? `/dashboard/${resolvedVenueId}` : '/dashboard';

  if (loading) {
    return (
      <nav className="flex items-center justify-between h-24 px-6 bg-white border-b shadow-lg sticky top-0 z-20">
        <div className="flex items-center">
          <div className="w-[160px] h-[40px] bg-gray-200 animate-pulse rounded"></div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="flex items-center justify-between h-24 px-6 bg-white border-b shadow-lg sticky top-0 z-20">
      <div className="flex items-center">
        <Link href={homeHref} className="flex items-center">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio logo"
            width={160}
            height={40}
            priority
          />
        </Link>
      </div>
      <div className="flex items-center space-x-4">
  {/* Home goes to venue-specific dashboard */}
  <Link href={homeHref} className="text-gray-600 hover:text-gray-900">Home</Link>
        {showActions && (
          <>
            <Link href={`/dashboard/${resolvedVenueId}/settings`} className="text-gray-600 hover:text-gray-900">
              <Button variant="outline" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await supabase.auth.signOut();
                  console.log("[ClientNavBar] Signed out successfully");
                } finally {
                  window.location.href = '/sign-in?signedOut=true';
                }
              }}
            >
              Sign Out
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
