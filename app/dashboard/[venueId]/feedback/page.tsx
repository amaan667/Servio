
export const runtime = 'nodejs';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Link from 'next/link';
import { venuePath } from '@/lib/path';

export default async function FeedbackPage({ params }: { params: { venueId: string }}) {
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

  // Optional: assert venue ownership; don’t throw on failure, just show empty state
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

  const { data: rows, error } = await supa
    .from('order_feedback')
    .select('id, created_at, rating, comment, order_id')
    .order('created_at', { ascending: false });

  if (error) {
    console.log('[FEEDBACK] list error', error.message);
  }

  return (
    <div className="p-8">
      <nav className="mb-4">
        <Link href={venuePath(params.venueId)}>Home</Link> / <span>Feedback</span>
      </nav>
      <h1 className="text-2xl font-bold">Feedback</h1>
      {!rows?.length ? (
        <p className="text-gray-500 mt-4">No feedback yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map(r => (
            <li key={r.id} className="rounded border p-4">
              <div className="text-sm text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
              <div className="font-medium">Rating: {r.rating}/5</div>
              {r.comment && <div className="mt-1">{r.comment}</div>}
              <div className="text-xs text-gray-500 mt-1">Order: {r.order_id}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


