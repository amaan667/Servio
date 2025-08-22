"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Home, LogOut, User, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/sb-client';
import { useAuth } from '@/app/authenticated-client-provider';
import { useRouter } from "next/navigation";

export default function ClientNavBar({ showActions = true, venueId }: { showActions?: boolean; venueId?: string }) {
  const [primaryVenueId, setPrimaryVenueId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Use our central auth context
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchPrimaryVenue = async () => {
      try {
        if (session?.user) {
          const { data, error } = await supabase
            .from('venues')
            .select('venue_id')
            .eq('owner_id', session.user.id)
            .order('created_at', { ascending: true })
            .limit(1);

          if (!error && data?.length) {
            setPrimaryVenueId(data[0].venue_id);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching primary venue:', err);
        setLoading(false);
      }
    };

    if (!venueId) {
      fetchPrimaryVenue();
    } else {
      setPrimaryVenueId(venueId);
      setLoading(false);
    }
  }, [venueId, session]);

  const resolvedVenueId = venueId ?? primaryVenueId;

  if (loading) {
    return (
      <nav className="flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="flex items-center">
          <div className="w-[160px] h-[40px] bg-gray-200 animate-pulse rounded"></div>
        </div>
      </nav>
    );
  }

  // Home should link to main home page, dashboard link for navigation
  const homeHref = '/';
  const dashboardHref = resolvedVenueId ? `/dashboard/${resolvedVenueId}` : '/dashboard';
  const settingsHref = resolvedVenueId ? `/dashboard/${resolvedVenueId}/settings` : '/settings';

  console.log('[NAV] ClientNavBar', { venueId, resolvedVenueId, homeHref, settingsHref });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <nav className="flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="flex items-center">
        {/* Logo links to main home page */}
        <Link href={homeHref} className="flex items-center">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio logo"
            width={160}
            height={40}
            priority
            className="h-8 w-auto hover:opacity-80 transition-opacity"
          />
        </Link>
      </div>
      
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center space-x-4">
        {/* Home goes to main home page */}
        <Link 
          href={homeHref} 
          className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors"
        >
          Home
        </Link>
        {showActions && (
          <>
            <Link 
              href={settingsHref} 
              className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors"
            >
              Settings
            </Link>
            {/* Modern dropdown menu for user actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                >
                  <User className="h-4 w-4" />
                  <span className="text-sm font-medium">Account</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={homeHref} className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={settingsHref} className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center">
        {showActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center gap-2 p-2"
              >
                <User className="h-4 w-4" />
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={homeHref} className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Home
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={settingsHref} className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
