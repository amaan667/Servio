import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { venuePath } from '@/lib/path';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';
import QuestionsClient from './QuestionsClient';
import type { FeedbackQuestion } from '@/types/feedback';

export default async function FeedbackPage({ params }: { params: { venueId: string } }) {
  const jar = await cookies();
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: n => jar.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supa.auth.getUser();
  if (!user) {
    return (
      <div className="p-8">
        <p>Please sign in.</p>
        <Link href="/sign-in">Sign in</Link>
      </div>
    );
  }

  // Verify venue ownership
  const { data: venue, error: vErr } = await supa
    .from('venues')
    .select('venue_id, name')
    .eq('venue_id', params.venueId)
    .eq('owner_id', user.id)
    .maybeSingle();

  if (vErr || !venue) {
    console.log('[FEEDBACK] venue check failed', vErr?.message);
    notFound();
  }

  // Load initial questions
  let initialQuestions: FeedbackQuestion[] = [];
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/feedback_questions?venue_id=eq.${params.venueId}&select=*&order=sort_index.asc,created_at.asc`, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      initialQuestions = await response.json();
    }
  } catch (error) {
    console.error('[FEEDBACK] Failed to load initial questions:', error);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <NavigationBreadcrumb venueId={params.venueId} />

      <h1 className="text-3xl font-bold mb-8">Feedback</h1>
      <h2 className="text-2xl font-semibold mb-6">Feedback Questions</h2>

      <QuestionsClient venueId={params.venueId} initialQuestions={initialQuestions} />
    </div>
  );
}


