# KDS System - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Run Database Migration (2 min)

1. Open Supabase Dashboard → SQL Editor
2. Copy & paste contents of `migrations/kds-system-schema.sql`
3. Click "Run"
4. Verify: You should see "Success" message

### Step 2: Deploy Code (1 min)

If using Railway:
```bash
railway up
```

Or commit to git:
```bash
git add .
git commit -m "Add KDS system"
git push origin main
```

### Step 3: Test (2 min)

1. Navigate to `/dashboard/[your-venue-id]/kds`
2. You should see KDS dashboard with default stations
3. Place a test order through your QR system
4. Tickets should appear automatically in "New" column

**That's it! KDS is live! 🎉**

---

## 📋 What Was Built

### Files Created

```
migrations/
└── kds-system-schema.sql ..................... Database tables & triggers

app/api/kds/
├── stations/route.ts ......................... Manage stations
└── tickets/
    ├── route.ts .............................. Manage tickets
    └── bulk-update/route.ts .................. Bulk operations

app/dashboard/[venueId]/kds/
├── page.tsx .................................. Server component
└── KDSClient.tsx ............................. Main UI component

types/
└── kds.ts .................................... TypeScript definitions

Documentation/
├── KDS-SYSTEM-README.md ...................... Full documentation
├── KDS-IMPLEMENTATION-SUMMARY.md ............. Technical details
├── KDS-VISUAL-GUIDE.md ....................... Visual guide
└── KDS-QUICK-START.md (this file) ............ Quick setup
```

### Database Tables

- ✅ `kds_stations` - Kitchen stations (Grill, Fryer, etc.)
- ✅ `kds_tickets` - Individual order item tickets
- ✅ `kds_station_categories` - Category-to-station routing

### Key Features

- ✅ **Automatic ticket creation** when orders placed
- ✅ **Real-time updates** via Supabase
- ✅ **3-column Kanban layout** (New → In Progress → Ready)
- ✅ **Station filtering** (view one station or all)
- ✅ **Priority indicators** (color-coded by age)
- ✅ **Auto-sync with Live Orders** (status updates)
- ✅ **Special instructions display**
- ✅ **Grouped ready orders** for efficient bumping
- ✅ **Mobile responsive** design

---

## 🎯 How It Works

### The Flow

```
1. Customer orders → 2. Tickets auto-created → 3. Kitchen preps → 4. Server delivers
```

### Example: Table 5 orders 2 burgers

```
ORDER PLACED
    ↓
KDS creates ticket:
┌─────────────────┐
│ 2x Burger       │
│ Table 5         │
│ [START PREP]    │ ← Chef clicks
└─────────────────┘

COOKING (5 min)
    ↓
┌─────────────────┐
│ 2x Burger       │
│ Table 5         │
│ [READY] ←───────┤ ← Chef clicks when done
└─────────────────┘

READY FOR SERVICE
    ↓
Server picks up food, clicks "BUMP"
    ↓
Order complete!
```

---

## 🔑 Key Concepts

### 1. Stations
Think of stations as different prep areas:
- **Grill** - Hot items (burgers, steaks)
- **Fryer** - Fried items (fries, wings)  
- **Barista** - Drinks (coffee, smoothies)
- **Expo** - Default/assembly area

### 2. Tickets
Each order item gets its own ticket:
- Shows what to make
- Which table it's for
- Any special requests
- How long it's been waiting

### 3. Status Flow
```
NEW → IN_PROGRESS → READY → BUMPED
```

### 4. Auto-Sync
When tickets change, orders update automatically:
- First ticket starts → Order = "IN_PREP"
- All tickets ready → Order = "READY"  
- All bumped → Order = "COMPLETED"

---

## 💡 Pro Tips

### For Kitchen Staff
1. ⚡ **Click "Start Prep" immediately** - Updates servers
2. 🎯 **Watch the colors** - Red = urgent
3. 📝 **Read special instructions** - Yellow box
4. ⏱️ **Mark ready ASAP** - Don't let food sit

### For Managers
1. 📊 **Monitor all stations** - Use "ALL" view
2. 🔍 **Check for red tickets** - These are overdue
3. 🔄 **Enable auto-refresh** - Stay updated
4. 📱 **Use on tablet** - Mount in expo area

---

## 🎨 Customization

### Add a Station

```sql
INSERT INTO kds_stations (venue_id, station_name, station_type, color_code)
VALUES ('your-venue-id', 'Salad Bar', 'cold', '#10b981');
```

### Auto-Route Categories

```sql
-- Send all salads to Salad Bar
INSERT INTO kds_station_categories (venue_id, station_id, menu_category)
VALUES ('your-venue-id', 'salad-bar-station-id', 'Salads');
```

---

## 🐛 Troubleshooting

### Problem: No tickets appearing

**Check:**
1. Did you run the migration?
2. Is the order status "PLACED"?
3. Do stations exist? (Check "ALL" tab)

**Fix:** Run setup function
```sql
SELECT setup_default_kds_stations('your-venue-id');
```

### Problem: Can't access KDS page

**Check:**
1. Are you logged in?
2. Do you own this venue?

**Fix:** Check browser console for errors

### Problem: Real-time not working

**Check:**
1. Is Supabase Realtime enabled?
2. Any console errors?

**Fix:** Toggle auto-refresh off/on

---

## 📚 Need More Help?

- 📖 **Full Docs:** [KDS-SYSTEM-README.md](./KDS-SYSTEM-README.md)
- 🔧 **Technical:** [KDS-IMPLEMENTATION-SUMMARY.md](./KDS-IMPLEMENTATION-SUMMARY.md)
- 🎨 **Visual Guide:** [KDS-VISUAL-GUIDE.md](./KDS-VISUAL-GUIDE.md)

---

## ✅ Quick Checklist

Before going live:

- [ ] Database migration run successfully
- [ ] Can access `/dashboard/[venueId]/kds`
- [ ] Default stations visible
- [ ] Test order creates tickets
- [ ] Can move tickets between columns
- [ ] "Bump Order" removes tickets
- [ ] Live Orders shows correct status
- [ ] Real-time updates working
- [ ] Staff trained on workflow

---

**Ready to go live? Place a test order and watch the magic happen! ✨**

**Questions?** Check the full documentation or create an issue.

---

Last updated: October 9, 2025  
Version: 1.0.0

