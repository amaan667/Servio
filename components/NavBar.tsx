import { Button } from "./ui/button";
import { supabase } from "@/lib/supabase";
import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function NavBar({ showActions = true }: { showActions?: boolean }) {
  return (
    <nav className="flex items-center justify-between h-24 px-6 bg-white border-b shadow-lg sticky top-0 z-20">
      <div className="flex items-center">
        <Link href="/" className="flex items-center">
          <div className="w-48 h-16 relative"> {/* Increased size */}
            <Image
              src="/assets/servio-logo-updated.png"
              alt="Servio"
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <span className="text-servio-purple text-2xl font-bold ml-2">Servio</span>
        </Link>
      </div>
      <div className="flex items-center space-x-4">
        <Link href="/" className="text-gray-600 hover:text-gray-900">Home</Link>
        <Link href="#features" className="text-gray-600 hover:text-gray-900">Features</Link>
        <Link href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
        {showActions && (
          <>
            <Button variant="ghost" size="sm">
              <Settings className="h-5 w-5 mr-2" />
              Settings
            </Button>
            <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
              Sign Out
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}