export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSupabaseForRoute } from '@/lib/supabase-server'

export async function POST(req: Request) {
	try {
		const body = await req.json()
		const { access_token, refresh_token } = body || {}

		if (!access_token || !refresh_token) {
			return NextResponse.json({ success: false, error: 'Missing tokens' }, { status: 400 })
		}

		const res = NextResponse.json({ success: true })
		const supabase = getSupabaseForRoute(res)

		const { error } = await supabase.auth.setSession({ access_token, refresh_token })
		if (error) {
			return NextResponse.json({ success: false, error: error.message }, { status: 400 })
		}

		return res
	} catch (e: any) {
		return NextResponse.json({ success: false, error: e?.message || 'Failed to sync session' }, { status: 500 })
	}
}