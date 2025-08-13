import { Button } from "./ui/button";
import { supabase } from "@/lib/sb-client";
import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function NavBar({ showActions = true }: { showActions?: boolean }) {
  const handleSignOut = async () => {
    try {
      // Prefer server-side sign out to clear HttpOnly cookies reliably
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/sign-out';
        return;
      }
    } catch (e) {
      console.error('Error signing out:', e);
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/sign-out';
      }
    }
  };

  return (
    <nav className="flex items-center justify-between h-16 sm:h-20 px-4 sm:px-6 bg-white border-b shadow-lg sticky top-0 z-20">
      <div className="flex items-center min-w-0">
        <Link href="/" className="flex items-center min-w-0">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio logo"
            width={128}
            height={32}
            className="mr-3 w-auto h-6 sm:h-8 object-contain"
            priority
          />
        </Link>
      </div>
      <div className="flex items-center gap-3 sm:gap-6">
        <Link
          href="/"
          className="text-gray-700 hover:text-gray-900 font-medium text-sm sm:text-base"
        >
          Home
        </Link>
        {showActions && (
          <>
            <Link href="/settings" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="text-sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="text-sm">
              Sign Out
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}