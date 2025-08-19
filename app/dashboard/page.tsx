export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Plus } from 'lucide-react';

export default async function DashboardIndexPage(props: any) {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: venues, error } = await supabase
    .from('venues')
    .select('venue_id, name, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  const firstVenueId = venues?.[0]?.venue_id as string | undefined;
  console.log('[HOME NAV TEST] user=', !!user, 'venueId=', firstVenueId ?? null);

  if (!error && firstVenueId) {
    redirect(`/dashboard/${firstVenueId}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Venues</h1>
          <p className="text-gray-600 mt-2">Manage your restaurant locations and orders</p>
        </div>

        {venues && venues.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <Card key={venue.venue_id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="h-5 w-5 mr-2" />
                    {venue.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Link href={`/dashboard/${venue.venue_id}`}>
                      <Button className="w-full">
                        Manage Venue
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Venues Yet</h3>
              <p className="text-gray-500 mb-4">Get started by creating your first venue</p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Venue
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}