# Auth Architecture - Consistent Cookie-Based System

## Overview

The platform now uses a **consistent server-side auth approach** where cookies work properly, while keeping public pages accessible without auth.

---

## ✅ Pages Requiring Auth (Server-Side Fetch)

### 1. Home Page (`app/page.tsx`)
**Status**: ✅ **FIXED** - Server-side auth

```typescript
// Fetches on server where cookies work
const { data: { user } } = await supabase.auth.getUser();
// Fetches user's plan from organizations table
// Passes initialUserPlan to client
```

**Why**: Needs to show correct pricing CTAs based on user's plan

---

### 2. Settings Page (`app/dashboard/[venueId]/settings/page.tsx`)
**Status**: ✅ **FIXED** - Server-side auth

```typescript
// Fetches on server where cookies work
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/sign-in");
// Passes initialUser to client
```

**Why**: Requires authenticated user to load/modify settings

---

### 3. Root Layout (`app/layout.tsx`)
**Status**: ✅ **ALREADY CORRECT** - Server-side auth

```typescript
// Checks for auth cookies first
if (hasAuthCookies) {
  const supabase = await createServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  // Passes initialSession to AuthProvider
}
```

**Why**: Provides auth context to entire app

---

## ✅ Pages NOT Requiring Auth (No Server Auth)

### 1. Main Dashboard (`app/dashboard/[venueId]/page.tsx`)
**Status**: ✅ **CORRECT** - Uses admin client

```typescript
const supabase = createAdminClient(); // No auth required!
// Fetches public dashboard data
```

**Why**: Dashboard data is public (for viewing menus), auth checked client-side for management features

---

### 2. Live Orders Page (`app/dashboard/[venueId]/live-orders/page.tsx`)
**Status**: ✅ **CORRECT** - Client-side only

```typescript
// Client component, no server-side auth
export default function LiveOrdersPage({ params }) {
  return <LiveOrdersClient venueId={params.venueId} />;
}
```

**Why**: Client handles auth via AuthProvider, uses API routes for data

---

### 3. Public Pages (Sign-in, Sign-up, Demo, etc.)
**Status**: ✅ **CORRECT** - No auth needed

- `/sign-in` - Public
- `/sign-up` - Public  
- `/demo` - Public
- `/auth/callback` - Client-side OAuth handling

---

## 🔐 API Routes - Authentication Pattern

### Protected API Routes
**Pattern**: Use `getUserSafe()` which reads cookies server-side

```typescript
import { getUserSafe } from "@/utils/getUserSafe";

export async function GET(request: NextRequest) {
  const user = await getUserSafe();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... proceed with authenticated request
}
```

**Examples**:
- `/api/staff/invitations` ✅
- `/api/stripe/*` ✅
- `/api/ai-assistant/*` ✅

### Public API Routes
**Pattern**: Use `createAdminClient()` for public data

```typescript
import { createAdminClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  // ... fetch public data
}
```

**Examples**:
- `/api/dashboard/orders` ✅ (venueId-scoped)
- `/api/menu/[venueId]` ✅ (public menu)
- `/api/live-orders` ✅ (public view)

---

## 📋 Consistency Rules

### ✅ DO: Pages with Auth Requirements

**When to fetch auth on server**:
1. Page displays user-specific data (pricing plan, settings)
2. Page requires redirect if not authenticated
3. Page needs to prevent flicker/loading states

**How**:
```typescript
// Server Component
export default async function MyPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/sign-in");
  
  return <MyClientPage initialUser={user} />;
}
```

### ❌ DON'T: Public Pages

**When NOT to fetch auth on server**:
1. Page is public (sign-in, demo, marketing)
2. Page works for both logged-in and logged-out users
3. Page data is venue-scoped, not user-scoped

**How**:
```typescript
// Server Component - NO auth fetch
export default async function PublicPage() {
  // Fetch public data with admin client
  return <ClientPage />;
}
```

---

## 🔍 Cookie vs LocalStorage Issue

### The Core Problem

**Browser Supabase Client**:
```typescript
createBrowserClient(url, key, {
  auth: {
    persistSession: true,  // Uses localStorage!
  }
})
```

- ✅ Can read/write localStorage
- ❌ Cannot read HTTP-only cookies
- ❌ Cannot read cookies set by server

**Server Supabase Client**:
```typescript
createServerSupabase() // Has cookies integration
```

- ✅ Can read/write cookies
- ✅ Cookies persist across requests
- ✅ Works with Next.js App Router

### The Solution

**For any page that needs auth on initial load**:
1. Fetch user on **server** (where cookies work)
2. Pass `initialUser` or `initialSession` to client
3. Client uses server-provided data
4. Client still subscribes to auth state changes via AuthProvider

---

## 🎯 Current Architecture Summary

```
┌─────────────────────────────────────────────┐
│         Root Layout (Server)                │
│  - Checks cookies                           │
│  - Fetches session if cookies exist         │
│  - Passes to AuthProvider                   │
└─────────────┬───────────────────────────────┘
              │
              ├─── Home Page (Server) ✅ NEW
              │    - Fetches user & plan
              │    - Passes initialUserPlan
              │
              ├─── Settings Page (Server) ✅ NEW
              │    - Fetches user
              │    - Redirects if no user
              │    - Passes initialUser
              │
              ├─── Dashboard (Server) ✅ CORRECT
              │    - Uses admin client (public)
              │    - Client checks auth separately
              │
              └─── Public Pages ✅ CORRECT
                   - No server auth
                   - Client-only
```

---

## 📊 Auth Data Flow

### Server-Side (Cookies)
```
Request → HTTP Cookies → createServerSupabase() → getUser() → ✅ Works
```

### Client-Side (LocalStorage)
```
Browser → localStorage → createBrowserClient() → getUser() → ❌ Fails (empty)
Browser → cookies → createBrowserClient() → getUser() → ❌ Can't read cookies
```

### Solution: Server → Client
```
Server (cookies) → getUser() → ✅ User data
           ↓
Pass to client component as prop
           ↓
Client uses initialUser → ✅ Works
```

---

## 🔐 Authentication Methods Summary

| Method | Where | Works With | Use Case |
|--------|-------|------------|----------|
| `createServerSupabase()` | Server | Cookies ✅ | Pages, API routes |
| `supabaseBrowser()` | Client | localStorage ❌ | Client-side actions |
| `createAdminClient()` | Server | Service key | Public data, admin ops |
| `getUserSafe()` | API routes | Cookies ✅ | Protected API endpoints |

---

## ✅ Verification Checklist

### Pages Using Server-Side Auth (NEW)
- ✅ `/` (app/page.tsx) - Fetches user + plan
- ✅ `/dashboard/[venueId]/settings` - Fetches user

### Pages Using Client-Side Auth (CORRECT)
- ✅ Root Layout - Passes session to AuthProvider
- ✅ `/dashboard/[venueId]` - Public data, client checks auth
- ✅ `/auth/callback` - Client-side OAuth

### Public Pages (NO AUTH)
- ✅ `/sign-in`, `/sign-up`
- ✅ `/demo`
- ✅ Marketing pages

### API Routes Using getUserSafe()
- ✅ `/api/staff/*`
- ✅ `/api/stripe/*`
- ✅ `/api/ai-assistant/*`

### API Routes Using Admin Client
- ✅ `/api/menu/[venueId]` - Public menu
- ✅ `/api/dashboard/orders` - Venue-scoped
- ✅ `/api/live-orders` - Public view

---

## 🎯 Consistency Achieved

✅ **Server-side auth** for pages needing user data on load  
✅ **Client-side auth** for interactive features via AuthProvider  
✅ **Public pages** never check auth  
✅ **API routes** use getUserSafe() for protected endpoints  
✅ **Admin client** for public/venue-scoped data  

The architecture is now **consistent** and **cookie-based** throughout! 🎉

---

## Expected Behavior After Deployment

### Home Page Pricing
- Logged out: "Start Free Trial" on all plans ✅
- Basic plan user: "Current Plan" on Basic, "Upgrade" on others ✅
- Premium plan user: "Current Plan" on Premium, "Downgrade" on others ✅

### Settings Page
- Logged out: Redirect to `/sign-in` ✅
- Logged in: Loads immediately with settings form ✅

### Dashboard
- Anyone: Can view (uses admin client) ✅
- Auth via client: Management features only for authenticated users ✅

