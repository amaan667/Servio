import { createClient } from '@/lib/supabase/server'
import { hasSbAuthCookie } from './hasSbAuthCookie'

export async function getUserSafe(context?: string) {
  if (!(await hasSbAuthCookie())) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[AUTH GUARD] ${context ?? ''}: No auth cookie, skipping getUser()`)
    }
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error?.code === 'refresh_token_not_found') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[AUTH GUARD] ${context ?? ''}: Refresh token not found`)
    }
    return null
  }

  if (error) {
    console.error(`[AUTH GUARD] ${context ?? ''}: getUser() error`, error)
    return null
  }

  return data.user ?? null
}
