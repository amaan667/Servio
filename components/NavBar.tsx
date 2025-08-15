
import { Button } from "./ui/button";
import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getPrimaryVenueId } from '@/lib/server/getPrimaryVenue';

export default async function NavBar({ showActions = true, venueId }: { showActions?: boolean; venueId?: string }) {
  const resolvedVenueId = venueId ?? (await getPrimaryVenueId());
  const homeHref = '/dashboard';
  // Avoid dumping cookies in production logs and mutating them here
  return (
    <nav className="flex items-center justify-between h-32 px-6 bg-white border-b shadow-lg sticky top-0 z-20">
      <div className="flex items-center">
        <Link href={homeHref} className="flex items-center group">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio logo"
            width={240}
            height={60}
            priority
            className="h-48 w-auto transition-all duration-300 group-hover:scale-105"
          />
        </Link>
      </div>
      <div className="flex items-center space-x-4">
        <Link href={homeHref} className="text-gray-600 hover:text-gray-900">Home</Link>
        <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
        {showActions && (
          <>
            <Link href={'/settings'}>
              <Button variant="ghost" size="sm" className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </Button>
            </Link>
            <Link href="/auth/sign-out">
              <Button variant="destructive" size="sm">Sign Out</Button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}