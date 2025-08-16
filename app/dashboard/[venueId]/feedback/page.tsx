export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import NavigationBreadcrumb from '@/components/navigation-breadcrumb';

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

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, orders!inner(id, table_number)')
    .eq('venue_id', params.venueId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="max-w-5xl mx-auto px-3 py-4 sm:p-6">
      <NavigationBreadcrumb customBackPath={`/dashboard/${params.venueId}`} customBackLabel="Dashboard" />
      <h1 className="text-2xl font-bold mb-4">Customer Feedback</h1>
      <div className="space-y-3">
        {(reviews||[]).length === 0 ? (
          <div className="text-sm text-gray-500">No feedback yet.</div>
        ) : (
          (reviews||[]).map((r:any)=> (
            <div key={r.id} className="border rounded p-3 bg-background">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n=> (
                    <span key={n} className={n<=r.rating? 'text-yellow-400':'text-gray-300'}>★</span>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              {r.comment ? <div className="mt-2 text-sm">{r.comment}</div> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}


