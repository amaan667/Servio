import { Button } from "./ui/button";
import { supabase } from "@/lib/supabase";
import { Settings } from "lucide-react";
import Image from "next/image";

export function NavBar({ showActions = true }: { showActions?: boolean }) {
  return (
    <nav className="flex items-center justify-between h-48 px-20 bg-white border-b shadow-lg sticky top-0 z-20">
      <div className="flex items-center space-x-10">
        <div className="flex items-center transform hover:scale-115 transition-transform duration-300">
          <div className="flex-shrink-0">
            <Image
              src="/assets/servio-logo-updated.png"
              alt="Servio"
              width={200}
              height={200}
              priority
              className="drop-shadow-2xl"
              style={{
                width: '200px',
                height: '200px',
              }}
            />
          </div>
          <span className="text-servio-purple text-7xl font-extrabold tracking-tight drop-shadow-xl ml-10">
            Servio
          </span>
        </div>
      </div>
      {showActions && (
        <div className="flex items-center space-x-8">
          <Button variant="ghost" size="lg">
            <Settings className="h-6 w-6 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="lg" onClick={() => supabase.auth.signOut()}>
            Sign Out
          </Button>
        </div>
      )}
    </nav>
  );
}
