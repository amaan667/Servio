export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { hasSupabaseAuthCookies } from '@/lib/auth/utils';
import { redirect } from 'next/navigation';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

export default async function MenuManagementPage({ params }: { params: { venueId: string } }) {
  const cookieStore = await cookies();
  const names = cookieStore.getAll().map(c => c.name);
  if (!hasSupabaseAuthCookies(names)) {
    return <div>Please sign in.</div>;
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <div>Please sign in.</div>;
  }

  const { data: venue, error } = await supabase
    .from('venues')
    .select('id, name, slug, owner_id')
    .eq('slug', params.venueId)
    .single();

  if (error) {
    console.error('Failed to load venue', error);
    return <div>Error loading venue</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb venueId={params.venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Menu Management for {venue.name}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Manage your menu items and categories
          </p>
        </div>
        
        <div>Menu Management for {venue.name}</div>
      </div>
    </div>
  );
}