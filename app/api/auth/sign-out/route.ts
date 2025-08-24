import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function POST() {
  console.log('[AUTH] Sign-out request received')
  
  const jar = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => jar.get(name)?.value,
        set: (name, value, options) => jar.set(name, value, options),
        remove: (name, options) => jar.set(name, '', { ...options, maxAge: 0 })
      }
    }
  )
  
  await supabase.auth.signOut()
  console.log('[AUTH] Session cleared successfully')
  
  return NextResponse.json({ ok: true })
}


