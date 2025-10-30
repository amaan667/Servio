# Comprehensive Logging Enabled 📊

## Overview
Added detailed logging throughout the settings page and feature sections to track exactly what happens in production Railway logs.

---

## Changes Made

### 1. ✅ Console Logs NOT Suppressed in Production

**File**: `next.config.mjs`

**Before**:
```javascript
compiler: {
  removeConsole: process.env.NODE_ENV === 'production' ? {
    exclude: ['error', 'warn'],  // Only kept errors and warnings
  } : false,
},
```

**After**:
```javascript
compiler: {
  // Keep ALL console logs in production for debugging
  removeConsole: false,  // ALL logs visible in Railway
},
```

**Result**: All `console.log()`, `console.info()`, `console.warn()`, and `console.error()` statements will appear in Railway logs.

---

### 2. ✅ Settings Page Comprehensive Logging

**File**: `app/dashboard/[venueId]/settings/settings-client.tsx`

#### Logs Added:

**Component Mount**:
```typescript
console.log("[SETTINGS PAGE] 🚀 Settings page component mounted", { venueId });
console.log("[SETTINGS CLIENT] 🎨 Component mounted/rendered", { venueId });
```

**Cache Check**:
```typescript
console.log("[SETTINGS CLIENT] 💾 Checking cache:", { hasCached });
```

**Session Fetch**:
```typescript
console.log("[SETTINGS] 📡 Fetching user session...");
console.log("[SETTINGS] ✅ User authenticated:", { userId, email });
// OR
console.error("[SETTINGS] ❌ No user session found - user not authenticated");
```

**Data Fetching**:
```typescript
console.log("[SETTINGS] 📊 Fetching venue data, roles, and organization...");
console.log("[SETTINGS] 📋 Query results:", {
  hasVenue, venueError,
  hasUserRole, userRole, userRoleError,
  allVenuesCount, allVenuesError,
  hasOrganization, organizationError
});
```

**Permission Checks**:
```typescript
console.log("[SETTINGS] 🔐 Permission check:", {
  isOwner, isManager, userRole
});
```

**Manager Special Case**:
```typescript
console.log("[SETTINGS] 👤 User is manager but not owner, fetching venue data...");
console.log("[SETTINGS] ✅ Manager venue fetched:", !!managerVenue);
```

**Data State Update**:
```typescript
console.log("[SETTINGS] 💾 Setting data state:", {
  hasVenue, venueName,
  hasOrganization, organizationId, subscriptionTier,
  userRole, venuesCount
});
```

**Caching**:
```typescript
console.log("[SETTINGS] ✅ Data cached to sessionStorage");
```

**Success**:
```typescript
console.log("[SETTINGS] ✅ Settings loaded successfully!");
```

**Errors**:
```typescript
console.error("[SETTINGS] ❌ Error loading settings:", error);
console.error("[SETTINGS] Error details:", { message, stack });
```

---

### 3. ✅ Feature Sections Logging

**File**: `app/dashboard/[venueId]/components/FeatureSections.tsx`

#### Logs Added:

**Component Render**:
```typescript
console.log("[FEATURE SECTIONS] 🎨 Rendering FeatureSections", { venueId, userRole });
```

**Insights Section Logic**:
```typescript
// When owner or manager
console.log("[FEATURE SECTIONS] ✨ Adding Insights section for", { userRole, venueId });

// When staff or other
console.log("[FEATURE SECTIONS] ℹ️ Insights section NOT shown - user role:", { userRole, venueId });
```

**Sections Summary**:
```typescript
console.log("[FEATURE SECTIONS] 📊 Total sections to render:", sections.length);
sections.forEach((section, idx) => {
  console.log(`[FEATURE SECTIONS] Section ${idx + 1}:`, {
    title: section.title,
    featuresCount: section.features.length,
    features: section.features.map(f => f.title),
  });
});
```

**Feature Click**:
```typescript
console.log("[FEATURE CLICK] 🖱️ Feature card clicked:", {
  feature: feature.title,
  section, href, venueId, userRole
});
```

---

## How to Use in Railway

### View Live Logs

1. **Go to Railway Dashboard**
2. **Select your project**: `servio-production`
3. **Click on "Logs" tab**
4. **Filter by search**: Use these prefixes to find specific logs:
   - `[SETTINGS PAGE]` - Settings page events
   - `[SETTINGS]` - Settings data loading
   - `[FEATURE SECTIONS]` - Feature cards rendering
   - `[FEATURE CLICK]` - When user clicks a feature card

### Expected Log Flow When Settings is Clicked

```
1. [SETTINGS PAGE] 🚀 Settings page component mounted
2. [SETTINGS CLIENT] 🎨 Component mounted/rendered
3. [SETTINGS CLIENT] 💾 Checking cache: { hasCached: false }
4. [SETTINGS] 🚀 Starting to load settings data for venue: xyz
5. [SETTINGS] 📡 Fetching user session...
6. [SETTINGS] ✅ User authenticated: { userId: "...", email: "..." }
7. [SETTINGS] 📊 Fetching venue data, roles, and organization...
8. [SETTINGS] 📋 Query results: { hasVenue: true, hasUserRole: true, ... }
9. [SETTINGS] 🔐 Permission check: { isOwner: true, isManager: false, ... }
10. [SETTINGS] 💾 Setting data state: { hasVenue: true, venueName: "...", ... }
11. [SETTINGS] ✅ Data cached to sessionStorage
12. [SETTINGS] ✅ Settings loaded successfully!
```

### Expected Log Flow for Feature Cards

```
1. [FEATURE SECTIONS] 🎨 Rendering FeatureSections { venueId, userRole }
2. [FEATURE SECTIONS] ✨ Adding Insights section for { userRole: "owner", venueId }
3. [FEATURE SECTIONS] 📊 Total sections to render: 3
4. [FEATURE SECTIONS] Section 1: { title: "Operations", featuresCount: 3, ... }
5. [FEATURE SECTIONS] Section 2: { title: "Management", featuresCount: 4, ... }
6. [FEATURE SECTIONS] Section 3: { title: "Insights", featuresCount: 3, features: ["Analytics", "Feedback", "Settings"] }
```

---

## Debugging Scenarios

### Scenario 1: Settings Page Blank

**Check logs for**:
- Is component mounting? Look for `[SETTINGS PAGE] 🚀`
- Is session found? Look for `[SETTINGS] ✅ User authenticated`
- Are queries successful? Check `[SETTINGS] 📋 Query results`
- Any errors? Look for `[SETTINGS] ❌`

### Scenario 2: Insights Cards Not Showing

**Check logs for**:
- Feature sections rendering? Look for `[FEATURE SECTIONS] 🎨`
- User role correct? Check the `userRole` value
- Insights added? Look for `[FEATURE SECTIONS] ✨ Adding Insights` 
  - OR `[FEATURE SECTIONS] ℹ️ Insights section NOT shown`
- How many sections rendered? Check `Total sections to render`

### Scenario 3: Settings Click Not Working

**Check logs for**:
- Click event logged? Look for `[FEATURE CLICK] 🖱️`
- Correct href? Check the `href` value in the log
- Is navigation happening? (If no logs after click, likely client-side error)

---

## Log Format

All logs use consistent prefixes for easy filtering:

| Prefix | Purpose |
|--------|---------|
| `[SETTINGS PAGE]` | Settings page component lifecycle |
| `[SETTINGS CLIENT]` | Settings client-side operations |
| `[SETTINGS]` | Settings data loading and state |
| `[FEATURE SECTIONS]` | Feature cards rendering |
| `[FEATURE CLICK]` | User interactions with feature cards |

---

## Important Notes

1. **Railway Logs**: All logs visible in Railway dashboard under "Logs" tab
2. **No Suppression**: Console logs are NOT removed in production build
3. **Performance**: These logs don't significantly impact performance
4. **Privacy**: Logs include IDs but not sensitive user data (passwords, tokens)
5. **Timestamps**: Railway automatically adds timestamps to all logs

---

## Testing Locally

Run the app locally and open browser console:

```bash
npm run dev
```

Navigate to:
- Dashboard: `/dashboard/[venueId]` - See feature sections logs
- Settings: `/dashboard/[venueId]/settings` - See settings page logs

All logs will appear in the browser console with the same format.

---

## What to Look For

### ✅ Successful Settings Load

```
[SETTINGS] ✅ User authenticated
[SETTINGS] 📋 Query results: { hasVenue: true, hasUserRole: true }
[SETTINGS] ✅ Settings loaded successfully!
```

### ✅ Insights Cards Displayed

```
[FEATURE SECTIONS] ✨ Adding Insights section for { userRole: "owner" }
[FEATURE SECTIONS] Section 3: { title: "Insights", featuresCount: 3 }
```

### ❌ Problems to Watch For

```
[SETTINGS] ❌ No user session found
[SETTINGS] ❌ Error loading settings: Object
[FEATURE SECTIONS] ℹ️ Insights section NOT shown - user role: "staff"
```

---

## Summary

✅ **ALL logs enabled** in production  
✅ **Settings page** fully instrumented with 15+ log points  
✅ **Feature sections** logged with role-based logic  
✅ **Railway logs** will show exact flow  
✅ **Easy debugging** with consistent prefixes  

The logs will tell you exactly:
- When settings page is clicked
- What data is fetched
- Why Insights cards show or don't show
- Any errors that occur

All logs are now visible in Railway production console! 🎉

