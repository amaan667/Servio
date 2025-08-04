import { Button } from "./ui/button";
import { supabase } from "@/lib/supabase";
import { Settings } from "lucide-react";

export function NavBar({ showActions = true }: { showActions?: boolean }) {
  return (
    <nav className="flex items-center justify-between h-24 px-12 bg-white border-b shadow-md sticky top-0 z-20">
      <div className="flex items-center space-x-6 -mt-1">
        <div className="flex items-center transform hover:scale-105 transition-transform duration-200">
          <img 
            src="/servio-logo.svg" 
            alt="Servio" 
            className="h-16 w-auto drop-shadow-xl" 
            style={{ minWidth: 64 }} 
          />
          <span className="text-servio-purple text-4xl font-extrabold tracking-tight drop-shadow-sm ml-4">Servio</span>
        </div>
      </div>
      {showActions && (
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
            Sign Out
          </Button>
        </div>
      )}
    </nav>
  );
}
