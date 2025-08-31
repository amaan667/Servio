'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import Image from "next/image";

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

  const homeHref = venueId ? `/dashboard/${venueId}` : '/dashboard';
  const settingsHref = venueId ? `/dashboard/${venueId}/settings` : '/dashboard';

  console.log('[NAV] NavBarClient mounted', { venueId, homeHref, settingsHref, pathname });

  return (
    <nav className="flex items-center justify-between h-28 px-6 bg-white border-b shadow-lg sticky top-0 z-20">
      {/* Left (Logo + Home) */}
      <div className="flex items-center">
        <Link href={homeHref} className="flex items-center" aria-label="Home">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio logo"
            width={200}
            height={50}
            priority
            className="h-32 w-auto hover:opacity-80 transition-opacity"
          />
        </Link>
      </div>

      {/* Right */}
      <div className="flex items-center space-x-4">
        <Link href={homeHref} className="text-gray-600 hover:text-gray-900 font-medium">Home</Link>
        <Link href={settingsHref} className="text-gray-600 hover:text-gray-900">
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
