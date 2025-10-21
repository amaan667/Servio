import { createClient } from '@/lib/supabase'
import { hasServerAuthCookie } from '@/lib/server-utils'

export async function getUserSafe() {
  if (!(await hasServerAuthCookie())) {
    return null
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error?.code === 'refresh_token_not_found') {
    // Try to refresh the session manually
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        return null
      }
      
      if (refreshData.session) {
        return refreshData.user
      }
    } catch {
      // Silent error handling
    }
    
    return null
  }

  if (error) {
    return null
  }

  return data.user ?? null
}
