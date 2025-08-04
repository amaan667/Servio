import { Button } from "./ui/button";
import { supabase } from "@/lib/supabase";
import { Settings } from "lucide-react";

export function NavBar({ showActions = true }: { showActions?: boolean }) {
  return (
    <nav className="flex items-center justify-between h-20 px-10 bg-white border-b shadow-sm sticky top-0 z-20">
      <div className="flex items-center space-x-6">
        <img src="/servio-logo.svg" alt="Servio" className="h-14 w-auto drop-shadow-lg" style={{ minWidth: 56 }} />
        <span className="text-servio-purple text-3xl font-extrabold tracking-tight drop-shadow-sm">Servio</span>
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
