# 🔍 Comprehensive Logging Guide

## Overview
This document describes all the logging that has been added to track feature page navigation and debugging in Railway deployment logs.

**Note: These logs are temporary for debugging purposes and can be removed once the issues are identified and resolved.**

---

## 📊 Log Categories

### 1. **Middleware Logging** (`middleware.ts`)
Tracks ALL incoming requests and routes:

**Log Markers:**
- `🔍 [MIDDLEWARE] Navigation request:` - Every navigation attempt with full details
- `⏭️  [MIDDLEWARE] Skipping static asset:` - Static files being bypassed
- `✅ [MIDDLEWARE] Public route allowed:` - Public routes being allowed
- `🎯 [MIDDLEWARE] Dashboard feature access:` - Dashboard feature page access
- `➡️  [MIDDLEWARE] Allowing route through:` - General route passthrough

**What it tracks:**
```javascript
{
  path: "/dashboard/venue-123/live-orders",
  method: "GET",
  url: "https://...",
  userAgent: "...",
  referer: "...",
  timestamp: "2025-10-22T..."
}
```

---

### 2. **Client-Side Navigation Logging**

#### **Bottom Navigation** (`components/GlobalBottomNav.tsx`)
Tracks when users click bottom navigation items on mobile:

**Log Marker:**
- `🔷 [BOTTOM NAV] Navigation clicked:`

**What it tracks:**
```javascript
{
  itemId: "live-orders",
  itemLabel: "Live Orders",
  href: "/dashboard/venue-123/live-orders",
  currentPath: "/dashboard/venue-123",
  venueId: "venue-123",
  timestamp: "2025-10-22T...",
  userAgent: "..."
}
```

#### **Feature Cards** (`app/dashboard/[venueId]/components/FeatureSections.tsx`)
Tracks when users click feature cards on the dashboard:

**Log Marker:**
- `🎯 [FEATURE CARD] Feature clicked:`

**What it tracks:**
```javascript
{
  featureTitle: "Live Orders",
  featureHref: "/dashboard/venue-123/live-orders",
  sectionTitle: "Operations",
  venueId: "venue-123",
  userRole: "owner",
  timestamp: "2025-10-22T...",
  userAgent: "..."
}
```

---

### 3. **Server-Side Feature Page Logging**

Each feature page now has comprehensive server-side logging at multiple stages:

#### **Pages with Full Logging:**
1. **Main Dashboard** (`app/dashboard/[venueId]/page.tsx`)
   - `🏠 [DASHBOARD PAGE] Main dashboard page accessed:`

2. **Live Orders** (`app/dashboard/[venueId]/live-orders/page.tsx`)
   - `📍 [LIVE ORDERS PAGE] Page accessed:`
   - `🔐 [LIVE ORDERS PAGE] Auth check:`
   - `⚠️  [LIVE ORDERS PAGE] No user found, showing loading spinner`
   - `✅ [LIVE ORDERS PAGE] Authorization check:`
   - `❌ [LIVE ORDERS PAGE] Access denied - user not authorized for venue`
   - `🚀 [LIVE ORDERS PAGE] Rendering page:`

3. **Menu Management** (`app/dashboard/[venueId]/menu-management/page.tsx`)
   - `📍 [MENU MANAGEMENT PAGE] Page accessed:`
   - `🔐 [MENU MANAGEMENT PAGE] Auth check:`
   - `⚠️  [MENU MANAGEMENT PAGE] No user found, showing loading spinner`
   - `✅ [MENU MANAGEMENT PAGE] Authorization check:`
   - `❌ [MENU MANAGEMENT PAGE] Access denied - user not authorized for venue`
   - `🚀 [MENU MANAGEMENT PAGE] Rendering page:`

4. **Kitchen Display System (KDS)** (`app/dashboard/[venueId]/kds/page.tsx`)
   - `📍 [KDS PAGE] Page accessed:`
   - `🔐 [KDS PAGE] Auth check:`
   - `⚠️  [KDS PAGE] No user found, showing loading spinner`
   - `✅ [KDS PAGE] Authorization check:`
   - `❌ [KDS PAGE] Access denied - user not authorized for venue`
   - `🚀 [KDS PAGE] Rendering page:`

5. **QR Codes** (`app/dashboard/[venueId]/qr-codes/page.tsx`)
   - `📍 [QR CODES PAGE] Page accessed:`
   - `🔐 [QR CODES PAGE] Auth check:`
   - `⚠️  [QR CODES PAGE] No user found, showing loading spinner`
   - `✅ [QR CODES PAGE] Authorization check:`
   - `❌ [QR CODES PAGE] Access denied - user not authorized for venue`
   - `🚀 [QR CODES PAGE] Rendering page:`

---

## 🔎 How to Use These Logs in Railway

### 1. **View Logs in Railway Dashboard**
```bash
# Go to: https://railway.app/project/YOUR_PROJECT/deployments
# Click on your deployment
# Click on "View Logs" tab
```

### 2. **Filter Logs by Category**
Use the emoji markers to quickly filter:
- `🔍` - Middleware logs
- `🔷` - Bottom navigation clicks
- `🎯` - Feature card clicks or dashboard feature access
- `📍` - Page access logs
- `🔐` - Authentication checks
- `✅` - Authorization checks
- `❌` - Access denied
- `🚀` - Successful page renders
- `⚠️` - Warnings/no user found

### 3. **Common Debugging Scenarios**

#### **Scenario 1: Feature page not loading**
Look for this sequence:
```
🔍 [MIDDLEWARE] Navigation request: { path: "/dashboard/venue-123/live-orders" }
🎯 [MIDDLEWARE] Dashboard feature access: { venueId: "venue-123", feature: "live-orders" }
📍 [LIVE ORDERS PAGE] Page accessed: { venueId: "venue-123" }
🔐 [LIVE ORDERS PAGE] Auth check: { hasSession: true, hasUser: true }
✅ [LIVE ORDERS PAGE] Authorization check: { isOwner: true, isStaff: false }
🚀 [LIVE ORDERS PAGE] Rendering page: { finalUserRole: "owner" }
```

#### **Scenario 2: User clicks but nothing happens**
Look for:
```
🔷 [BOTTOM NAV] Navigation clicked: { itemId: "live-orders", href: "/dashboard/..." }
```
Then check if corresponding middleware and page logs follow.

#### **Scenario 3: Authentication issues**
Look for:
```
🔐 [LIVE ORDERS PAGE] Auth check: { hasSession: false, hasUser: false }
⚠️  [LIVE ORDERS PAGE] No user found, showing loading spinner
```

#### **Scenario 4: Authorization issues**
Look for:
```
✅ [LIVE ORDERS PAGE] Authorization check: { isOwner: false, isStaff: false }
❌ [LIVE ORDERS PAGE] Access denied - user not authorized for venue
```

---

## 📝 Log Data Structure

### Typical Log Entry Contains:
- **venueId**: The venue being accessed
- **userId**: The authenticated user ID
- **timestamp**: ISO timestamp of the event
- **userAgent**: Browser/device information
- **hasSession/hasUser**: Authentication status
- **isOwner/isStaff**: Authorization status
- **role**: User's role (owner, manager, staff, etc.)
- **path/href**: The route being accessed

---

## 🗑️ Cleanup Instructions

Once debugging is complete, remove logging by searching for these patterns:

```typescript
// Search for:
console.info("🔍 [MIDDLEWARE]
console.info("🔷 [BOTTOM NAV]
console.info("🎯 [FEATURE
console.info("📍 [
console.info("🔐 [
console.info("✅ [
console.info("❌ [
console.info("🚀 [
console.info("⚠️  [
```

### Files to Clean:
1. `middleware.ts`
2. `components/GlobalBottomNav.tsx`
3. `app/dashboard/[venueId]/components/FeatureSections.tsx`
4. `app/dashboard/[venueId]/page.tsx`
5. `app/dashboard/[venueId]/live-orders/page.tsx`
6. `app/dashboard/[venueId]/menu-management/page.tsx`
7. `app/dashboard/[venueId]/kds/page.tsx`
8. `app/dashboard/[venueId]/qr-codes/page.tsx`

---

## 🐛 Additional Debugging Tips

### 1. **Check Request Timing**
All logs include ISO timestamps, so you can track the exact sequence and timing of events.

### 2. **Cross-Reference Client and Server Logs**
- Client logs (🔷, 🎯 from components) show what the user clicked
- Server logs (📍, 🔐, ✅, 🚀) show what happened on the server

### 3. **Look for Missing Logs**
If you see a navigation click (🔷) but no corresponding page access (📍), there's a routing issue.

### 4. **Check for Errors Between Logs**
Any errors that occur between logged steps will help identify the exact failure point.

---

## 📞 Support

If you need to add more logging or have questions about the logs, refer to this guide to understand the existing logging structure and patterns.

**Created:** October 22, 2025  
**Purpose:** Temporary debugging for Railway deployment issues  
**Status:** Active - Remove after debugging is complete

