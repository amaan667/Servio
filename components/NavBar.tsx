
import { Button } from "./ui/button";
import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getPrimaryVenueId } from '@/lib/server/getPrimaryVenue';

export default async function NavBar({ showActions = true, venueId }: { showActions?: boolean; venueId?: string }) {
  const resolvedVenueId = venueId ?? (await getPrimaryVenueId());
  const homeHref = resolvedVenueId ? `/dashboard/${resolvedVenueId}` : '/dashboard';
  // [NAV] Home link resolved
  console.log('[NAV] Home link:', homeHref);
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
        {/* Home should always go to the server dashboard resolver to preserve session */}
        <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Home</Link>
        {/* Remove extra Dashboard link in dashboard context */}
        {/* <Link href={homeHref} className="text-gray-600 hover:text-gray-900">Dashboard</Link> */}
        {showActions && (
          <>
            <Link href={resolvedVenueId ? `/dashboard/${resolvedVenueId}/settings` : '/dashboard'}>
              <Button variant="ghost" size="sm" className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </Button>
            </Link>
            {/* Server-side sign out route */}
            <Link href="/auth/sign-out">
              <Button variant="outline" size="sm">Sign Out</Button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}