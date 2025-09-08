# OAuth Configuration Implementation

This document outlines the complete OAuth configuration implementation following the exact specification provided.

## One-time Configuration

### 1. Supabase → Auth → URL Configuration

- **Site URL**: `https://your-domain.com`
- **Redirect URLs**: `https://your-domain.com/auth/callback`

### 2. Google Cloud Console (OAuth)

- **Authorized JS origins**: `https://your-domain.com`
- **Authorized redirect URIs**:
  - `https://<your-project>.supabase.co/auth/v1/callback`
  - `https://your-domain.com/auth/callback`

### 3. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## Implementation Files

### 1. Supabase Clients

#### `lib/supabase/server.ts` (server client bound to cookies)
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies as nextCookies } from 'next/headers'
import type { CookieOptions } from '@supabase/ssr'

export function createClient(c = nextCookies()) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return c.get(name)?.value },
        set(name, value, options: CookieOptions) { c.set(name, value, options) },
        remove(name, options: CookieOptions) { c.set(name, '', { ...options, maxAge: 0 }) },
      },
    }
  )
}
```

#### `lib/supabase/client.ts` (browser client w/ persistence)
```typescript
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
```

### 2. Base URL Helper

#### `lib/getBaseUrl.ts` (for proxies like Railway)
```typescript
import { headers } from 'next/headers'
export function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  const h = headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host  = h.get('x-forwarded-host') ?? h.get('host')!
  return `${proto}://${host}`
}
```

### 3. Google Sign-in Component

#### `components/GoogleButton.tsx`
```typescript
'use client'
import { supabase } from '@/lib/supabase/client'

export function GoogleButton() {
  return (
    <button
      onClick={async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
      }}
    >
      Continue with Google
    </button>
  )
}
```

### 4. OAuth Callback Route Handler

#### `app/auth/callback/route.ts`
```typescript
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/getBaseUrl'

export async function GET(req: Request) {
  const baseUrl = getBaseUrl()
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const err  = url.searchParams.get('error')

  if (err) return NextResponse.redirect(`${baseUrl}/?auth_error=${encodeURIComponent(err)}`)
  if (!code) return NextResponse.redirect(`${baseUrl}/`)

  const supabase = createClient(cookies())
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/?auth_error=exchange_failed&reason=${encodeURIComponent(error.message)}`
    )
  }
  return NextResponse.redirect(`${baseUrl}/dashboard`)
}
```

### 5. Auth Cookie Utility

#### `utils/hasSbAuthCookie.ts`
```typescript
import { cookies } from 'next/headers'
export function hasSbAuthCookie() {
  return cookies().getAll().some(c => c.name.includes('-auth-token'))
}
```

### 6. SSR User Reading Example

#### `app/dashboard-example/page.tsx`
```typescript
import { createClient } from '@/lib/supabase/server'
import { hasSbAuthCookie } from '@/utils/hasSbAuthCookie'
import { redirect } from 'next/navigation'

export default async function DashboardExamplePage() {
  const supabase = createClient()

  let user = null
  if (hasSbAuthCookie()) {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  }
  if (!user) redirect('/sign-in')

  // …load user data
  return <div>Welcome, {user.email}</div>
}
```

### 7. Middleware

#### `middleware.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
const PUBLIC = ['/', '/auth/callback', '/sign-in', '/_next', '/favicon', '/images']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()

  const hasSb = [...req.cookies.keys()].some(k => k.includes('-auth-token'))
  if (!hasSb) return NextResponse.redirect(new URL('/sign-in', req.url))

  return NextResponse.next()
}
```

### 8. Sign-out Route

#### `app/auth/sign-out/route.ts`
```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getBaseUrl } from '@/lib/getBaseUrl'

export async function POST() {
  const supabase = createClient(cookies())
  await supabase.auth.signOut() // clears cookies
  return NextResponse.redirect(`${getBaseUrl()}/`)
}
```

## Key Features

1. **Simple Implementation**: No complex PKCE handling or debugging functions
2. **Cookie-based Sessions**: Server-side session management with proper cookie handling
3. **Proxy Support**: Works with Railway and other proxy environments
4. **SSR Ready**: Proper server-side rendering with auth state checking
5. **Middleware Protection**: Simple route protection without complex auth checks

## Common Pitfalls Avoided

- ✅ Don't implement callback as a page; use a Route Handler and await the exchange
- ✅ Don't use the browser client on the server
- ✅ Don't hardcode localhost anywhere for redirects/origins
- ✅ If you have middleware, allow `/auth/callback` through and avoid calling Supabase without auth cookies
- ✅ If using `output: 'standalone'`, set `"start": "node .next/standalone/server.js"` or remove standalone

## Testing

Visit `/test-oauth-simple` to test the OAuth implementation with the simplified approach.

## Migration Notes

This implementation replaces the previous complex OAuth setup with a simpler, more reliable approach that follows Supabase's recommended patterns for Next.js App Router.
