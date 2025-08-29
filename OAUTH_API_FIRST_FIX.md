# OAuth API-First Flow Implementation

This document summarizes the changes made to implement a reliable OAuth flow that always goes through the API first to avoid static routing/prerender issues.

## Changes Made

### 1. Updated Sign-in Function (`lib/auth/signin.ts`)

- **Simplified the OAuth flow** to use Supabase's built-in PKCE
- **Changed redirect target** from `/auth/callback` to `/api/auth/callback`
- **Cleaned up localStorage** before starting OAuth to ensure clean state
- **Removed complex debugging** and focused on core functionality

```typescript
export async function signInWithGoogle() {
  const sb = createClient();

  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier")) {
        localStorage.removeItem(k);
      }
    });
    sessionStorage.removeItem("sb_oauth_retry");
  } catch {}

  await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      flowType: "pkce",
      // ✅ ALWAYS go to API first; it will 307 to /auth/callback **with** the full query
      redirectTo: `${siteOrigin()}/api/auth/callback`,
    },
  });
}
```

### 2. Fixed API Callback Route (`app/api/auth/callback/route.ts`)

- **Preserved entire querystring** using `u.search` instead of `u.searchParams`
- **Simplified the redirect** to ensure no data loss
- **Removed unnecessary logging** to focus on core functionality

```typescript
export async function GET(req: Request) {
  const u = new URL(req.url);
  // ✅ Preserve the entire querystring verbatim
  const dest = new URL(`/auth/callback${u.search}`, u.origin);
  return NextResponse.redirect(dest, { status: 307 });
}
```

### 3. Made Callback Page Resilient (`app/(auth)/auth/callback/page.tsx`)

- **Client-only rendering** to avoid SSR issues
- **Handles both search and hash parameters** for maximum compatibility
- **Added debug logging** to verify callback is receiving the query
- **Prevents OAuth loops** by scrubbing parameters after exchange
- **Simplified error handling** with clear error messages

```typescript
export default function OAuthCallback() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();

    (async () => {
      // Try to read from ?query and fallback to #hash if needed
      let qs = new URLSearchParams(window.location.search);
      if (!qs.get("code") && window.location.hash?.includes("code=")) {
        qs = new URLSearchParams(window.location.hash.slice(1));
      }

      // Debug log (remove if you prefer)
      console.log("[AUTH DEBUG] callback URL", {
        href: window.location.href,
        search: window.location.search,
        hash: window.location.hash,
        codePresent: !!qs.get("code"),
      });

      const code = qs.get("code");
      const err = qs.get("error");
      const next = sp.get("next") || "/dashboard";

      if (err) return router.replace("/sign-in?error=oauth_error");
      if (!code) return router.replace("/sign-in?error=missing_code");

      const { error } = await sb.auth.exchangeCodeForSession({ queryParams: qs });

      // scrub params to avoid accidental re-exchange on refresh
      try {
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = "";
        window.history.replaceState({}, "", url.toString());
      } catch {}

      if (error) return router.replace("/sign-in?error=exchange_failed");

      const { data: { session } } = await sb.auth.getSession();
      if (!session) return router.replace("/sign-in?error=no_session");

      router.replace(next);
    })().finally(() => { finished = true; });
  }, [router, sp]);

  return null;
}
```

### 4. Updated Middleware (`middleware.ts`)

- **Ensured auth routes are allowed** including `/api/auth/callback`
- **Added protection for URLs with code/error parameters**
- **Maintained existing protection logic** for dashboard routes

```typescript
export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const p = url.pathname;

  if (
    isAsset(p) ||
    p.startsWith("/api/auth/callback") ||
    p.startsWith("/auth/callback") ||
    url.searchParams.has("code") ||
    url.searchParams.has("error")
  ) {
    return NextResponse.next();
  }
  // ... rest of middleware logic
}
```

## Environment Configuration

Ensure your environment variables are properly configured:

### Railway Environment Variables
```
NEXT_PUBLIC_SITE_URL = https://servio-production.up.railway.app
NEXT_PUBLIC_SUPABASE_URL = https://<YOUR>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon>
```

### Supabase Auth Configuration
- **Site URL**: `https://servio-production.up.railway.app`
- **Additional Redirect URLs**: `https://servio-production.up.railway.app/api/auth/callback`

## Testing the Implementation

### Quick Test Steps

1. **Open DevTools Console** on `/sign-in`
2. **Click Google sign-in** → consent → redirected to:
   - `/api/auth/callback?code=...&state=...` → 307 → `/auth/callback?code=...&state=...`
3. **Check Console** for `[AUTH DEBUG] callback URL` log with `codePresent: true`
4. **Verify landing** on `/dashboard`

### Debugging

If `codePresent` is `false`:

1. **Check URL bar** - should show `?code=...` on `/auth/callback`
2. **If URL is missing parameters** - something is stripping the querystring (middleware or redirect)
3. **If URL has parameters but codePresent is false** - try incognito with no extensions

## Benefits of This Approach

1. **Eliminates static routing issues** - API routes are always dynamic
2. **Guarantees querystring preservation** - server-side redirect maintains all parameters
3. **Handles edge cases** - supports both search and hash parameters
4. **Prevents OAuth loops** - scrubs parameters after exchange
5. **Simplified debugging** - clear console logs for troubleshooting

This implementation should resolve the "both auth code and code verifier should be non-empty" failures by ensuring a reliable OAuth flow that preserves all necessary parameters throughout the authentication process.