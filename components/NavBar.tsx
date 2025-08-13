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
    <nav className="flex items-center justify-between h-24 px-6 bg-white border-b shadow-lg sticky top-0 z-20">
      <div className="flex items-center">
        <Link href="/" className="flex items-center">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio logo"
            width={160}
            height={40}
            className="mr-4"
            priority
          />
        </Link>
      </div>
      <div className="flex items-center space-x-6">
        <Link
          href="/"
          className="text-gray-700 hover:text-gray-900 font-medium text-lg"
        >
          Home
        </Link>
        <Link
          href="#features"
          className="text-gray-700 hover:text-gray-900 font-medium text-lg"
        >
          Features
        </Link>
        <Link
          href="#pricing"
          className="text-gray-700 hover:text-gray-900 font-medium text-lg"
        >
          Pricing
        </Link>
        {showActions && (
          <>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="text-lg">
                <Settings className="h-5 w-5 mr-2" />
                Settings
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}