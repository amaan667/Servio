"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { supabase } from '@/lib/sb-client';
import { useAuth } from '@/app/authenticated-client-provider';
import { useRouter } from "next/navigation";

export default function ClientNavBar({ showActions = true, venueId }: { showActions?: boolean; venueId?: string }) {
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Use our central auth context
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchPrimaryVenue = async () => {
      try {
        if (session?.user) {
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

  // Home should link to main home page, dashboard link for navigation
  const homeHref = '/';
  const dashboardHref = resolvedVenueId ? `/dashboard/${resolvedVenueId}` : '/dashboard';
  const settingsHref = resolvedVenueId ? `/dashboard/${resolvedVenueId}/settings` : '/settings';

  console.log('[NAV] ClientNavBar', { venueId, resolvedVenueId, homeHref, settingsHref });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/sign-in');
  };

  return (
    <nav className="flex items-center justify-between h-20 sm:h-24 lg:h-28 px-4 sm:px-6 bg-white border-b shadow-lg sticky top-0 z-20">
      <div className="flex items-center">
        {/* [NAV] Logo links to main home page */}
        <Link href={homeHref} className="flex items-center">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio logo"
            width={200}
            height={50}
            priority
            className="h-12 sm:h-14 lg:h-16 w-auto hover:opacity-80 transition-opacity"
          />
        </Link>
      </div>
      
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center space-x-4">
        {/* [NAV] Home goes to main home page */}
        <Link href={homeHref} className="text-gray-600 hover:text-gray-900 font-medium">Home</Link>
        {showActions && (
          <>
            <Link href={settingsHref} className="text-gray-600 hover:text-gray-900 font-medium">Settings</Link>
            {/* [NAV] Use client-side sign-out */}
            <Button variant="destructive" onClick={handleSignOut}>
              Sign Out
            </Button>
          </>
        )}
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center space-x-2">
        {showActions && (
          <>
            <Link href={settingsHref} className="text-gray-600 hover:text-gray-900">
              <Button variant="outline" size="sm" className="flex items-center p-2">
                <Settings className="h-4 w-4" />
                <span className="sr-only">Settings</span>
              </Button>
            </Link>
            <Button variant="destructive" size="sm" onClick={handleSignOut} className="px-3">
              <span className="sr-only">Sign Out</span>
              <span className="text-xs">Out</span>
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
