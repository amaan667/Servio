import { Button } from "./ui/button";
import { supabase } from "@/lib/supabase";
import { Settings } from "lucide-react";

export function NavBar({ showActions = true }: { showActions?: boolean }) {
  return (
    <nav className="flex items-center justify-between h-28 px-8 bg-white border-b shadow-lg sticky top-0 z-20">
      <div className="flex-1 flex items-center">
        <div className="flex items-center transform hover:scale-105 transition-transform duration-200 py-4">
          <div className="relative" style={{ minWidth: '180px', height: '80px' }}>
            <img 
              src="/servio-logo.svg" 
              alt="Servio" 
              className="absolute top-0 left-0 w-full h-full object-contain drop-shadow-2xl" 
            />
          </div>
          <span className="text-servio-purple text-5xl font-black tracking-tight drop-shadow-md ml-6 transform -translate-y-1">
            Servio
          </span>
        </div>
      </div>
      {showActions && (
        <div className="flex items-center space-x-6">
          <Button variant="ghost" size="lg" className="text-base">
            <Settings className="h-5 w-5 mr-3" />
            Settings
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            onClick={() => supabase.auth.signOut()}
            className="text-base font-medium"
          >
            Sign Out
          </Button>
        </div>
      )}
    </nav>
  );
}
