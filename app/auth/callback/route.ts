import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
	const url = new URL(req.url);
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');

	if (error) {
		return NextResponse.redirect(new URL('/?auth_error=oauth_error', url.origin));
	}

	if (code) {
		try {
			const supabase = await createClient();
			const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
			if (exchangeError) {
				return NextResponse.redirect(new URL('/?auth_error=exchange_failed', url.origin));
			}
		} catch {
			return NextResponse.redirect(new URL('/?auth_error=exchange_failed', url.origin));
		}
	}

	// Optional: route based on user having venues
	try {
		const supabase = await createClient();
		const { data: { session } } = await supabase.auth.getSession();
		if (session?.user?.id) {
			const { data: venues } = await supabase
				.from('venues')
				.select('venue_id')
				.eq('owner_id', session.user.id)
				.limit(1);
			if (venues && venues.length > 0) {
				return NextResponse.redirect(new URL(`/dashboard/${venues[0].venue_id}`, url.origin));
			}
			return NextResponse.redirect(new URL('/complete-profile', url.origin));
		}
	} catch {}

	return NextResponse.redirect(new URL('/dashboard', url.origin));
}