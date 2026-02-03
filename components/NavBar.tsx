import { Button } from "./ui/button";
import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getPrimaryVenueId } from "@/lib/server/getPrimaryVenue";
import { useAuth } from "@/app/auth/AuthProvider";

export default async function NavBar({
  showActions = true,
  venueId,
}: {
  showActions?: boolean;
  venueId?: string;
}) {
  const resolvedVenueId = venueId ?? (await getPrimaryVenueId());
  const homeHref = resolvedVenueId ? `/dashboard/${resolvedVenueId}` : "/";
  const { signOut } = useAuth();
  
  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };
  
  // Avoid dumping cookies in production logs and mutating them here
  return (
    <nav className="flex items-center justify-between h-20 sm:h-24 md:h-28 px-2 sm:px-4 lg:px-6 bg-white border-b shadow-lg sticky top-0 z-20">
      <div className="flex items-center md:-ml-2 sm:-ml-1 flex justify-center md:justify-start w-full md:w-auto">
        <Link href={homeHref} className="flex items-center">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio logo"
            width={800}
            height={250}
            className="h-12 sm:h-14 md:h-16 lg:h-18 xl:h-20 w-auto"
            priority
          />
        </Link>
      </div>
      <div className="flex items-center space-x-4 pr-4">
        <Link href={homeHref} className="text-foreground/80 hover:text-foreground">
          Home
        </Link>
        <Link href={homeHref} className="text-foreground/80 hover:text-foreground">
          Dashboard
        </Link>
        {showActions && (
          <>
            <Link href={resolvedVenueId ? `/dashboard/${resolvedVenueId}/settings` : "/"}>
              <Button variant="ghost" size="sm" className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </Button>
            </Link>
            <Button variant="destructive" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
