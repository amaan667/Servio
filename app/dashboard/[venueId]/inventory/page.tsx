export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { safeGetUser } from '@/lib/server-utils';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import dynamicImport from 'next/dynamic';
import { checkFeatureAccess, PREMIUM_FEATURES } from '@/lib/feature-gates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Zap } from 'lucide-react';
import Link from 'next/link';

const InventoryClient = dynamicImport(() => import('./InventoryClient'), {
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Inventory</h2>
        <p className="text-gray-700">Setting up your inventory management...</p>
      </div>
    </div>
  )
});

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  
  const { data: { user }, error } = await safeGetUser();
  
  if (error) {
    console.error('[INVENTORY] Auth error:', error);
    redirect('/sign-in');
  }
  
  if (!user) {
    redirect('/sign-in');
  }

  const supabase = await createServerSupabase();

  // Verify user owns this venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('venue_id', venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!venue) redirect('/dashboard');

  // Check feature access
  const featureAccess = await checkFeatureAccess(venueId, PREMIUM_FEATURES.INVENTORY);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <NavigationBreadcrumb venueId={venueId} />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Inventory for {venue.name}
          </h1>
          <p className="text-lg text-foreground mt-2">
            Track ingredients, manage stock levels, and control costs
          </p>
        </div>
        
        {!featureAccess.hasAccess ? (
          <Card className="border-purple-500">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-purple-500" />
                <CardTitle>Premium Feature</CardTitle>
              </div>
              <CardDescription>
                Inventory Management is available on the Premium plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-500" />
                  What you'll get with Premium:
                </h3>
                <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                  <li>• Track ingredient stock levels in real-time</li>
                  <li>• Automatic stock deduction when orders complete</li>
                  <li>• Recipe costing for accurate profit margins</li>
                  <li>• Low-stock alerts and auto-86 menu items</li>
                  <li>• CSV import/export for easy management</li>
                  <li>• Full stock movement history</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Link href="/checkout">
                  <Button variant="servio">
                    Upgrade to Premium
                  </Button>
                </Link>
                <Link href={`/dashboard/${venueId}`}>
                  <Button variant="outline">
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <InventoryClient venueId={venueId} venueName={venue.name} />
        )}
      </div>
    </div>
  );
}

