# Menu URL Scraping Solution for JavaScript Sites

## Problem:
- Website https://nurcafe.co.uk/menu uses JavaScript (React/Next.js)
- HTML shows "Loading..." placeholders
- Content loads dynamically after page renders
- Cheerio can't see JS-rendered content

## Solutions (Ranked Best to Worst):

### ✅ Solution 1: Use Browserless.io (Recommended)
**Best for production, handles ALL websites**

```typescript
// Add to .env
BROWSERLESS_API_KEY=your_key_here

// In /api/scrape-menu/route.ts
const browserlessUrl = `https://chrome.browserless.io/content?token=${process.env.BROWSERLESS_API_KEY}`;

const response = await fetch(browserlessUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: menuUrl,
    waitFor: 3000, // Wait for JS to load
    selector: 'body' // Wait for body to exist
  })
});

const { data } = await response.json();
// data now contains fully-rendered HTML with menu items
```

**Pricing**: $0.005 per request (very cheap)
**Signup**: https://www.browserless.io/

---

### ✅ Solution 2: Use Apify Web Scraper
**Managed scraping service, very reliable**

```typescript
// Uses Apify's web scraper actor
const apifyToken = process.env.APIFY_API_TOKEN;
const actorRun = await fetch(`https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items?token=${apifyToken}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startUrls: [{ url: menuUrl }],
    pageFunction: `async function pageFunction(context) {
      // Extract menu items from rendered page
      const items = [];
      document.querySelectorAll('.menu-item, .dish').forEach(el => {
        items.push({
          name: el.querySelector('.name')?.textContent,
          price: el.querySelector('.price')?.textContent
        });
      });
      return items;
    }`
  })
});
```

**Pricing**: Free tier available
**Signup**: https://apify.com/

---

### ✅ Solution 3: Simplest - Manual Entry Recommendation
**For now, since nurcafe.co.uk is YOUR site**

Since you control nurcafe.co.uk, you can:

1. **Add an API endpoint** to nurcafe.co.uk:
   ```
   GET https://nurcafe.co.uk/api/menu
   Returns: JSON with all menu items
   ```

2. **Fetch from your own API**:
   ```typescript
   // In hybrid-merge
   const menuData = await fetch('https://nurcafe.co.uk/api/menu');
   const items = await menuData.json();
   // Now you have the data directly!
   ```

This is the **fastest and most reliable** since you control both systems.

---

## 🎯 Recommended Implementation:

### For YOUR Use Case (nurcafe.co.uk):

Since this is your own website, **create a simple API endpoint** on nurcafe.co.uk:

```typescript
// /app/api/menu/route.ts on nurcafe.co.uk
export async function GET() {
  const supabase = createClient();
  const { data } = await supabase
    .from('menu_items')
    .select('name, description, price, category, image')
    .eq('is_available', true);
  
  return NextResponse.json({ items: data });
}
```

Then in Servio, just fetch from your own API:
```typescript
const response = await fetch('https://nurcafe.co.uk/api/menu');
const { items } = await response.json();
// Perfect! All menu data with images, prices, etc.
```

---

## Current Status:

✅ System detects JS-rendered sites
✅ Returns helpful error message
✅ Works for static HTML sites
❌ Doesn't work for JS sites (needs browser or API)

**Recommendation**: Add `/api/menu` endpoint to nurcafe.co.uk for instant, reliable access to your menu data.

