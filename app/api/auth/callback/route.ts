export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_APP_URL!
  const url = new URL(req.url)

  // Delegate PKCE exchange to the client callback where the code_verifier exists
  const redirectUrl = `${base}/auth/callback${url.search}`
  return NextResponse.redirect(redirectUrl, { status: 307 })
}