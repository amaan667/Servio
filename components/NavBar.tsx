
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
    <nav className="flex items-center justify-between h-80 sm:h-100 md:h-120 lg:h-140 xl:h-160 px-2 sm:px-4 lg:px-6 bg-white border-b shadow-lg sticky top-0 z-20">
      <div className="flex items-center -ml-2 sm:-ml-1">
        <Link href={homeHref} className="flex items-center">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio logo"
            width={800}
            height={250}
            className="h-80 sm:h-100 md:h-120 lg:h-140 xl:h-160 w-auto"
            priority
          />
        </Link>
      </div>
      <div className="flex items-center space-x-4">
        <Link href={homeHref} className="text-foreground/80 hover:text-foreground">Home</Link>
        <Link href="/dashboard" className="text-foreground/80 hover:text-foreground">Dashboard</Link>
        {showActions && (
          <>
            <Link href={'/dashboard'}>
              <Button variant="ghost" size="sm" className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </Button>
            </Link>
            <Link href="/sign-out">
              <Button variant="destructive" size="sm">Sign Out</Button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}