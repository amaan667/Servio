export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = false;

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/debug';
import ClientNavBar from '@/components/ClientNavBar';
import QuestionsClient from './QuestionsClient';

export default async function FeedbackPage({
  params,
}: {
  params: { venueId: string };
}) {
  console.log('[FEEDBACK] Page mounted for venue', params.venueId);
  
  const supabase = createServerSupabase();

  const { data: { user } } = await createClient().auth.getUser();
  log('FEEDBACK SSR user', { hasUser: !!user });
  if (!user) redirect('/sign-in');

  // Verify user owns this venue
  const { data: venue } = await supabase
    .from('venues')
    .select('venue_id, name')
    .eq('venue_id', params.venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!venue) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      <ClientNavBar venueId={params.venueId} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Feedback for {venue.name}
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Manage customer feedback and questions
          </p>
        </div>
        
        <QuestionsClient venueId={params.venueId} />
      </div>
    </div>
  );
}


