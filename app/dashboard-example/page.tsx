import { createClient } from '@/lib/supabase/server'
import { hasSbAuthCookie } from '@/utils/hasSbAuthCookie'
import { redirect } from 'next/navigation'

export default async function DashboardExamplePage() {
  const supabase = await createClient()

  let user = null
  if (await hasSbAuthCookie()) {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  }
  if (!user) redirect('/sign-in')

  // …load user data
  return <div>Welcome, {user.email}</div>
}
