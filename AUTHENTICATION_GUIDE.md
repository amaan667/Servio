# Secure Supabase Authentication for Next.js App Router

This guide provides a corrected implementation for Supabase authentication in Next.js App Router that fixes the issues you were experiencing with mobile browsers and security warnings.

## Issues Fixed

1. **Punycode Deprecation Warning**: Fixed by using the userland `punycode` package
2. **Security Warning**: Now uses `supabase.auth.getUser()` instead of `getSession()` for authentication checks
3. **Mobile Browser Sign-out Issues**: Proper cookie handling in server-side sign-out API
4. **Cookie Modification Errors**: Correct implementation that works with Next.js App Router

## Key Changes

### 1. Fixed Punycode Warning

**package.json**:
```json
{
  "dependencies": {
    "punycode": "^2.3.1"
  }
}
```

**next.config.mjs**:
```javascript
webpack: (config) => {
  config.resolve.alias['punycode'] = 'punycode';
  // ... rest of config
}
```

### 2. Secure Authentication with `getUser()`

**Server-side** (`lib/supabase/server.ts`):
```typescript
// SECURE: Use getUser() instead of getSession() for authentication
export async function getAuthenticatedUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}
```

**Client-side** (`hooks/use-auth.ts`):
```typescript
// SECURE: Use getUser() for authentication checks
const { data: { user }, error } = await supabase.auth.getUser();
```

### 3. Mobile-Compatible Sign-out

**API Route** (`app/api/auth/signout/route.ts`):
```typescript
export async function POST() {
  const supabase = await createServerSupabase();
  
  // SECURE: Use getUser() for authentication check
  const { data: { user } } = await supabase.auth.getUser();
  
  // Perform sign-out
  await supabase.auth.signOut();
  
  // Clear cookies properly
  const response = NextResponse.json({ ok: true });
  // ... cookie clearing logic
}
```

## Implementation Guide

### 1. Setup Authentication Provider

Wrap your app with the `AuthProvider`:

```tsx
// app/layout.tsx
import { AuthProvider } from '@/components/auth-provider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 2. Use Authentication in Client Components

```tsx
'use client';
import { useAuthContext } from '@/components/auth-provider';

export function MyComponent() {
  const { user, loading, signOut } = useAuthContext();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;
  
  return (
    <div>
      <p>Welcome, {user.email}!</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### 3. Protect Routes

**Client-side protection**:
```tsx
import { ProtectedRoute } from '@/components/protected-route';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div>Protected content here</div>
    </ProtectedRoute>
  );
}
```

**Server-side protection**:
```tsx
import { requireAuth } from '@/lib/auth/server';

export default async function ServerProtectedPage() {
  const user = await requireAuth('/sign-in');
  
  return <div>Welcome, {user.email}!</div>;
}
```

### 4. API Route Authentication

```typescript
// app/api/protected/route.ts
import { getAuthUserForAPI } from '@/lib/auth/server';

export async function GET() {
  const { user, error } = await getAuthUserForAPI();
  
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return NextResponse.json({ data: 'Protected data' });
}
```

## File Structure

```
├── lib/
│   ├── supabase/
│   │   ├── server.ts          # Server-side Supabase client
│   │   └── client.ts          # Client-side Supabase client
│   └── auth/
│       └── server.ts          # Server-side auth utilities
├── hooks/
│   └── use-auth.ts            # Secure authentication hook
├── components/
│   ├── auth-provider.tsx      # Authentication context provider
│   ├── protected-route.tsx    # Route protection component
│   └── sign-out-button.tsx    # Sign-out button component
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── signout/
│   │           └── route.ts   # Sign-out API endpoint
│   └── dashboard-example/     # Example protected page
└── package.json               # Updated with punycode dependency
```

## Best Practices

### 1. Always Use `getUser()` for Authentication

❌ **Don't use**:
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (session?.user) { /* ... */ }
```

✅ **Do use**:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (user) { /* ... */ }
```

### 2. Handle Sign-out Properly

Always call the server-side sign-out API first, then the client-side:

```typescript
const signOut = async () => {
  // 1. Server-side sign-out (clears cookies)
  await fetch('/api/auth/signout', { method: 'POST' });
  
  // 2. Client-side sign-out (clears local state)
  await supabase.auth.signOut();
};
```

### 3. Use Proper Error Handling

```typescript
const { user, error } = await getAuthenticatedUser();
if (error) {
  console.error('Auth error:', error);
  // Handle error appropriately
}
```

### 4. Mobile Browser Considerations

- Enable session persistence: `persistSession: true`
- Enable auto token refresh: `autoRefreshToken: true`
- Use proper cookie settings for mobile compatibility

## Testing

### Test Sign-out on Mobile

1. Sign in on a mobile browser
2. Navigate to a protected page
3. Click sign-out
4. Verify you're redirected to sign-in page
5. Verify you can't access protected pages

### Test Authentication Security

1. Check browser console for security warnings
2. Verify `getUser()` is used instead of `getSession()`
3. Test API routes with and without authentication

## Troubleshooting

### Still seeing punycode warnings?

1. Make sure `punycode` is in your `package.json`
2. Verify the webpack alias in `next.config.mjs`
3. Clear your `.next` cache: `rm -rf .next`

### Sign-out not working on mobile?

1. Check that cookies are being cleared properly
2. Verify the server-side sign-out API is being called
3. Check browser console for errors

### Authentication not persisting?

1. Verify `persistSession: true` is set in client config
2. Check that cookies are being set properly
3. Verify the auth state listener is working

## Migration from Old Implementation

If you're migrating from the old implementation:

1. Replace `useAuth()` calls with `useAuthContext()`
2. Update server-side auth checks to use `getUser()`
3. Replace direct `supabase.auth.signOut()` calls with the new sign-out flow
4. Update protected routes to use the new components

This implementation provides a secure, mobile-compatible authentication system that follows Supabase best practices and works reliably across all browsers.