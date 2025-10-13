import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import { POSDashboardClient } from './pos-dashboard-client';

interface POSPageProps {
  params: Promise<{
    venueId: string;
  }>;
}

export default async function POSPage({ params }: POSPageProps) {
  const { venueId } = await params;
  
  const { user } = await getAuthenticatedUser();
  if (!user) return null;

  const supabase = await createServerSupabase();

  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, venue_name, slug, owner_user_id')
    .or(`venue_id.eq.${venueId},slug.eq.${venueId}`)
    .eq('owner_user_id', user.id)
    .maybeSingle();

  if (!venue) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            POS System
          </h1>
          <p className="text-base sm:text-lg text-foreground mt-2">
            Complete point-of-sale and kitchen display system
          </p>
        </div>
        
        <Suspense fallback={<div className="text-center py-8 text-gray-900">Loading POS system...</div>}>
          <POSDashboardClient venueId={venueId} />
        </Suspense>
      </div>
    </div>
  );
}
