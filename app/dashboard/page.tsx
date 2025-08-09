import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

export default async function DashboardPage() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (n) => cookies().get(n)?.value,
        set: (n, v, o) => cookies().set({ name: n, value: v, ...o }),
        remove: (n, o) => cookies().set({ name: n, value: '', ...o }),
      },
    }
  )

  // 1) Get user on the server
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  // 2) (Optional) gate onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', user.id)
    .maybeSingle()

  if (profile && profile.onboarding_complete === false) {
    redirect('/complete-profile')
  }

  // 3) Load initial dashboard data here (serverside)
  // const { data: venues } = await supabase.from('venues').select('*').eq('owner_id', user.id)

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-gray-600 mt-2">Welcome, {user.email}</p>
      {/* TODO: render real dashboard content using server-fetched data */}
    </main>
  )
}
