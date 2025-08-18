
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
            className="mr-4"
            priority
          />
          <span className="text-servio-purple text-3xl font-bold ml-3">Servio</span>
        </Link>
      </div>
      <div className="flex items-center space-x-4">
        <Link href={homeHref} className="text-gray-600 hover:text-gray-900">Home</Link>
        <Link href={homeHref} className="text-gray-600 hover:text-gray-900">Dashboard</Link>
        <Link href="#features" className="text-gray-600 hover:text-gray-900">Features</Link>
        <Link href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
        {showActions && (
          <>
            <Button variant="ghost" size="sm">
              <Settings className="h-5 w-5 mr-2" />
              Settings
            </Button>
            {/* Sign Out button logic can be added here if needed */}
          </>
        )}
      </div>
    </nav>
  );
}