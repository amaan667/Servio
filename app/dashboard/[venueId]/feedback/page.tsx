export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MessageSquareMore, BarChart3 } from 'lucide-react';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import QuestionsClient from './QuestionsClient';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export default async function FeedbackPage({
  params,
}: {
  params: { venueId: string };
}) {
  const supabase = createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id,name')
    .eq('venue_id', params.venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!venue) return notFound();

  // Read current count just for the header stats
  const { count } = await supabase
    .from('feedback_questions')
    .select('*', { count: 'exact', head: true })
    .eq('venue_id', venue.venue_id);

  const { count: activeCount } = await supabase
    .from('feedback_questions')
    .select('*', { count: 'exact', head: true })
    .eq('venue_id', venue.venue_id)
    .eq('is_active', true);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navigation Breadcrumb */}
      <NavigationBreadcrumb 
        customBackPath={`/dashboard/${venue.venue_id}`} 
        customBackLabel="Dashboard" 
        venueId={venue.venue_id} 
      />

      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Feedback Questions
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Manage customer feedback questions for {venue.name}
            </p>
          </div>

          <div className="flex gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <div className="text-sm">
                <div className="font-medium text-blue-900 dark:text-blue-100">
                  {activeCount ?? 0} Active
                </div>
                <div className="text-blue-600 dark:text-blue-400">
                  of {count ?? 0} Total
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left: Add New Question */}
        <div className="xl:col-span-1">
          <Card className="h-fit shadow-lg border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MessageSquareMore className="h-6 w-6 text-primary" />
                </div>
                <span>Add New Question</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Create engaging questions to collect valuable customer feedback
              </p>
            </CardHeader>
            <CardContent>
              <QuestionsClient venueId={venue.venue_id} mode="form-only" />
            </CardContent>
          </Card>
        </div>

        {/* Right: Current Questions */}
        <div className="xl:col-span-2">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Current Questions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage and organize your feedback questions
              </p>
            </CardHeader>
            <CardContent>
              <QuestionsClient venueId={venue.venue_id} mode="list-only" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


