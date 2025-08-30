import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/getBaseUrl'

export async function POST() {
  const supabase = await createClient(cookies())
  await supabase.auth.signOut() // clears cookies
  return NextResponse.redirect(`${await getBaseUrl()}/`)
}
