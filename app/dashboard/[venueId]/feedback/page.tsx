import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Link from 'next/link';
import { venuePath } from '@/lib/path';
import FeedbackBuilderClient from './FeedbackBuilderClient';

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
    return (
      <div className="p-8">
        <nav className="mb-4">
          <Link href={venuePath(params.venueId)}>Home</Link> / <span>Feedback</span>
        </nav>
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="text-gray-500 mt-2">No access to this venue or it does not exist.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Navigation */}
      <nav className="mb-6">
        <Link 
          href={venuePath(params.venueId)} 
          className="text-blue-600 hover:text-blue-800 transition-colors"
        >
          Home
        </Link>
        <span className="mx-2 text-gray-500">/</span>
        <span className="text-gray-900">Feedback</span>
      </nav>

      <h1 className="text-3xl font-bold mb-8">Feedback Questions</h1>
      <p className="text-gray-600 mb-8">
        Create custom feedback questions for your customers. These will appear on the order confirmation page.
      </p>

      <FeedbackBuilderClient venueId={params.venueId} />
    </div>
  );
}


