'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Settings, CreditCard } from "lucide-react";
import Image from "next/image";
import { VenueSwitcher } from "@/components/venue-switcher";

function extractVenueId(pathname: string | null) {
  if (!pathname) return undefined;
  const m = pathname.match(/\/dashboard\/([^/]+)/);
  return m?.[1];
}

export default function NavBarClient() {
  const params = useParams() as { venueId?: string };
  const pathname = usePathname();

  const venueId = useMemo(
    () => params?.venueId ?? extractVenueId(pathname),
    [params?.venueId, pathname]
  );

  const homeHref = venueId ? `/dashboard/${venueId}` : '/';
  const settingsHref = venueId ? `/dashboard/${venueId}/settings` : '/';
  const billingHref = venueId ? `/dashboard/${venueId}/billing` : '/';


  return (
    <nav className="flex items-center justify-between h-20 sm:h-24 md:h-28 px-0 bg-white border-b shadow-lg sticky top-0 z-20">
      {/* Logo - Top-left on desktop, centered on mobile */}
      <div className="flex items-center md:-ml-4 flex justify-center md:justify-start w-full md:w-auto gap-4">
        <Link href={homeHref} className="flex items-center" aria-label="Home">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio logo"
            width={800}
            height={250}
            priority
            className="h-12 sm:h-14 md:h-16 lg:h-18 xl:h-20 w-auto hover:opacity-80 transition-opacity"
          />
        </Link>
        {/* Venue Switcher */}
        <VenueSwitcher currentVenueId={venueId} />
      </div>

      {/* Right - Properly spaced from right edge */}
      <div className="flex items-center space-x-4 pr-4">
        <Link href={homeHref} className="text-gray-900 hover:text-gray-900 font-medium">Home</Link>
        <Link href={billingHref} className="text-gray-900 hover:text-gray-900">
          <Button variant="outline" className="flex items-center">
            <CreditCard className="mr-2 h-4 w-4" />
            Billing
          </Button>
        </Link>
        <Link href={settingsHref} className="text-gray-900 hover:text-gray-900">
          <Button variant="outline" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </Link>

        {/* Sign Out via API to clear cookies reliably */}
        <Button
          variant="destructive"
          onClick={() => {
            fetch('/api/auth/signout', { method: 'POST' }).finally(() => {
              window.location.href = '/sign-in';
            });
          }}
        >
          Sign Out
        </Button>
      </div>
    </nav>
  );
}
