export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import FeedbackClient from './FeedbackClient';

export default async function FeedbackPage({ params }: { params: { venueId: string } }) {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: customQuestions } = await supabase
    .from('feedback_questions')
    .select('*')
    .eq('venue_id', params.venueId)
    .order('created_at', { ascending: false });

  const { data: questionResponses } = await supabase
    .from('feedback_responses')
    .select('*, feedback_questions!inner(*)')
    .eq('venue_id', params.venueId)
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-5xl mx-auto px-3 py-4 sm:p-6">
      <NavigationBreadcrumb customBackPath={`/dashboard/${params.venueId}`} customBackLabel="Dashboard" />
      <FeedbackClient 
        venueId={params.venueId}
        customQuestions={customQuestions || []}
        questionResponses={questionResponses || []}
      />
    </div>
  );
}


