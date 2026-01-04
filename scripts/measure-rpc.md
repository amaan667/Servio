# How to Test Loading Times in Milliseconds

## Quick Methods (Browser DevTools)

### Method 1: Browser Console (Easiest)

1. **Open DevTools** (F12 or Cmd+Option+I)
2. **Go to Console tab**
3. **Paste this code:**

```javascript
// Measure page load
const perf = performance.getEntriesByType('navigation')[0];
if (perf) {
  console.table({
    'TTFB (Time to First Byte)': (perf.responseStart - perf.requestStart).toFixed(2) + 'ms',
    'Download Time': (perf.responseEnd - perf.responseStart).toFixed(2) + 'ms',
    'DOM Interactive': (perf.domInteractive - perf.fetchStart).toFixed(2) + 'ms',
    'DOM Complete': (perf.domComplete - perf.fetchStart).toFixed(2) + 'ms',
    'Load Complete': (perf.loadEventEnd - perf.fetchStart).toFixed(2) + 'ms',
  });
}
```

### Method 2: Network Tab (Best for API calls)

1. **Open DevTools** → **Network tab**
2. **Refresh page** (Cmd+R / Ctrl+R)
3. **Filter by "rpc"** to see `get_access_context` call
4. **Hover over requests** to see timing breakdown:
   - **Queuing**: Time in queue
   - **Waiting (TTFB)**: Time to first byte
   - **Content Download**: Transfer time

### Method 3: Performance Tab (Detailed profiling)

1. **Open DevTools** → **Performance tab**
2. **Click Record** (⏺️)
3. **Navigate to dashboard page**
4. **Stop recording**
5. **View timing breakdown** - shows exactly where time is spent

## Test Specific Operations

### Test RPC Call Time

In browser console, before navigating:

```javascript
// Mark start
performance.mark('rpc-start');

// After page loads, check timing
window.addEventListener('load', () => {
  const entries = performance.getEntriesByName('rpc-start');
  const loadTime = performance.now() - entries[0].startTime;
  console.log(`⏱️  RPC Call Time: ${loadTime.toFixed(2)}ms`);
});
```

### Test Dashboard Page Load

```javascript
// Copy into console on dashboard page
const navTiming = performance.getEntriesByType('navigation')[0];
console.log({
  'Server Response': (navTiming.responseStart - navTiming.requestStart).toFixed(2) + 'ms',
  'Page Load': (navTiming.loadEventEnd - navTiming.fetchStart).toFixed(2) + 'ms',
  'DOM Ready': (navTiming.domContentLoadedEventEnd - navTiming.fetchStart).toFixed(2) + 'ms',
});
```

## Expected Results (After Optimization)

- **TTFB**: < 200ms (Time to First Byte)
- **RPC Call** (`get_access_context`): < 50ms
- **Page Load**: < 1000ms (First Contentful Paint)
- **DOM Interactive**: < 1500ms
- **Total Load**: < 2000ms

## Compare Before/After

1. **Before**: Multiple sequential auth queries (should see 3-4 separate queries)
2. **After**: Single `get_access_context` RPC call (1 query)

To verify the optimization worked:

```javascript
// In Network tab, filter by "rpc"
// Before: Should see 4+ separate queries (venues, user_venue_roles, organizations, etc.)
// After: Should see only 1 query: get_access_context
```

