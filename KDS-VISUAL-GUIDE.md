# Kitchen Display System (KDS) - Visual Guide

## 🎯 Quick Overview

The KDS system is a **back-of-house kitchen management tool** that displays order tickets organized by preparation stations. Think of it as a digital ticket rail for your kitchen.

## 📱 User Interface

### Main Dashboard View

```
╔════════════════════════════════════════════════════════════════════╗
║  Kitchen Display System                    Your Restaurant Name     ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  📊 STATS AT A GLANCE                                               ║
║  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          ║
║  │ New      │  │ In Prog  │  │ Ready    │  │ Total    │          ║
║  │   5      │  │    3     │  │    2     │  │   10     │          ║
║  └──────────┘  └──────────┘  └──────────┘  └──────────┘          ║
║                                                                      ║
║  🏪 STATION SELECTOR                                                ║
║  ┌──────────┬──────────┬──────────┬──────────┬──────────┐         ║
║  │   ALL    │  🔴 GRILL │ 🟠 FRYER │ 🟣 COFFEE│ 🔵 COLD  │         ║
║  └──────────┴──────────┴──────────┴──────────┴──────────┘         ║
║                                                                      ║
║  📋 TICKET BOARD                                                    ║
║  ┌──────────────┬──────────────┬──────────────┐                   ║
║  │   NEW (5)    │ IN PROGRESS  │  READY (2)   │                   ║
║  │              │     (3)      │              │                   ║
║  ├──────────────┼──────────────┼──────────────┤                   ║
║  │              │              │              │                   ║
║  │   (tickets)  │   (tickets)  │   (tickets)  │                   ║
║  │              │              │              │                   ║
╚══╧══════════════╧══════════════╧══════════════╧═══════════════════╝
```

## 🎫 Ticket Card Anatomy

### New Ticket
```
┌─────────────────────────────────────┐
│ 🟢 2x CHEESEBURGER                  │ ← Quantity & Item Name
│ ─────────────────────────────────── │
│ 📍 Table 5                          │ ← Table Location
│ 👤 John Doe                         │ ← Customer Name (optional)
│                                     │
│ ⚠️  SPECIAL INSTRUCTIONS:           │
│    No onions, extra cheese          │ ← Special requests
│                                     │
│ ⏱️  2 minutes ago                   │ ← Time since ordered
│                                     │
│ ┌─────────────────────────────────┐ │
│ │      ▶️  START PREP              │ │ ← Action button
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### In Progress Ticket
```
┌─────────────────────────────────────┐
│ 🟡 1x MARGHERITA PIZZA              │
│ ─────────────────────────────────── │
│ 📍 Table 12                         │
│                                     │
│ ⚠️  SPECIAL INSTRUCTIONS:           │
│    Extra crispy                     │
│                                     │
│ ⏱️  8 minutes ago                   │ ← Turning orange/red
│                                     │
│ ┌─────────────┬─────────────────┐  │
│ │ ⏮️  RESET   │  ✅  READY      │  │ ← Two options
│ └─────────────┴─────────────────┘  │
└─────────────────────────────────────┘
```

### Ready Ticket (Grouped by Order)
```
┌─────────────────────────────────────┐
│ 📍 TABLE 5 - John Doe               │ ← Order header
│ ─────────────────────────────────── │
│ ✅ 2x Cheeseburger                  │
│ ✅ 1x Fries                         │ ← All items for this order
│ ✅ 2x Coke                          │
│                                     │
│ ⏱️  Ready 3 minutes ago             │ ← Time sitting ready
│                                     │
│ ┌─────────────────────────────────┐ │
│ │  🚀  BUMP ORDER (SERVE)          │ │ ← Bump entire order
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 🎨 Color Coding System

### Ticket Priority (By Age)

```
┌────────────────────────────────┐
│ 🟢 GREEN BORDER (< 5 min)      │  Fresh order, no rush
├────────────────────────────────┤
│ 🟡 YELLOW BORDER (5-10 min)    │  Normal timing
├────────────────────────────────┤
│ 🟠 ORANGE BORDER (10-15 min)   │  Getting old, prioritize
├────────────────────────────────┤
│ 🔴 RED BORDER (> 15 min)       │  URGENT! Customer waiting
└────────────────────────────────┘
```

### Station Colors

```
Expo        🔵 Blue
Grill       🔴 Red
Fryer       🟠 Orange
Barista     🟣 Purple
Cold Prep   🔵 Cyan
```

## 🔄 Workflow States

### Kitchen Staff Workflow

```
       NEW TICKET ARRIVES
              │
              │ Chef sees new order
              ▼
       ┌─────────────┐
       │ Click "Start│
       │    Prep"    │
       └──────┬──────┘
              │
              ▼
    ┌──────────────────┐
    │  IN PROGRESS     │
    │  (Cooking...)    │
    └────────┬─────────┘
             │
             │ Food ready
             ▼
       ┌─────────────┐
       │Click "Ready"│
       └──────┬──────┘
              │
              ▼
    ┌──────────────────┐
    │     READY        │
    │ (Wait for server)│
    └────────┬─────────┘
             │
             │ Server picks up
             ▼
       ┌─────────────┐
       │ Click "Bump"│
       │   Order     │
       └──────┬──────┘
              │
              ▼
         COMPLETED
    (Removed from KDS)
```

## 📊 Real-World Example

### Scenario: Busy Lunch Rush

#### 12:15 PM - Order Arrives
```
Customer at Table 7 orders:
- 2x Cheeseburger (Grill Station)
- 2x Fries (Fryer Station)
- 2x Coke (Barista Station)
```

#### KDS Automatically Creates 3 Tickets:

**GRILL STATION:**
```
┌─────────────────────────────────┐
│ 🟢 2x CHEESEBURGER             │
│ Table 7                         │
│ ⏱️  Just now                    │
│ [START PREP]                    │
└─────────────────────────────────┘
```

**FRYER STATION:**
```
┌─────────────────────────────────┐
│ 🟢 2x FRIES                    │
│ Table 7                         │
│ ⏱️  Just now                    │
│ [START PREP]                    │
└─────────────────────────────────┘
```

**BARISTA STATION:**
```
┌─────────────────────────────────┐
│ 🟢 2x COKE                     │
│ Table 7                         │
│ ⏱️  Just now                    │
│ [START PREP]                    │
└─────────────────────────────────┘
```

#### 12:18 PM - Grill Chef Starts
```
GRILL - IN PROGRESS:
┌─────────────────────────────────┐
│ 🟡 2x CHEESEBURGER             │
│ Table 7                         │
│ ⏱️  3 minutes ago               │
│ [RESET] [READY]                 │
└─────────────────────────────────┘
```

#### 12:22 PM - Burgers Done
```
GRILL - READY:
(Moved to Ready column)
```

#### 12:24 PM - All Items Ready
```
READY COLUMN:
┌─────────────────────────────────┐
│ TABLE 7                         │
│ ✅ 2x Cheeseburger              │
│ ✅ 2x Fries                     │
│ ✅ 2x Coke                      │
│ ⏱️  Ready 2 minutes ago         │
│ [🚀 BUMP ORDER]                 │
└─────────────────────────────────┘
```

#### 12:25 PM - Server Delivers
Server clicks "BUMP ORDER" → Tickets disappear from KDS

## 🔗 Integration with Other Systems

### How KDS Talks to Live Orders

```
┌─────────────────────┐         ┌─────────────────────┐
│    LIVE ORDERS      │◄───────►│        KDS          │
│   (Front of House)  │         │  (Back of House)    │
└─────────────────────┘         └─────────────────────┘
         │                               │
         │ Order Status Updates          │
         │◄──────────────────────────────┤
         │                               │
         │ • First ticket starts         │
         │   → Order: "IN_PREP"          │
         │                               │
         │ • All tickets ready           │
         │   → Order: "READY"            │
         │                               │
         │ • All tickets bumped          │
         │   → Order: "COMPLETED"        │
         │                               │
```

### Server's View in Live Orders

When kitchen updates KDS, servers see:

```
LIVE ORDERS SCREEN:
┌─────────────────────────────────────┐
│ Order #123 - Table 7                │
│ Status: 🔴 IN_PREP ← Auto-updated   │
│ • 2x Cheeseburger (cooking...)      │
│ • 2x Fries (cooking...)             │
│ • 2x Coke (ready)                   │
└─────────────────────────────────────┘

       ↓ (All items ready)

┌─────────────────────────────────────┐
│ Order #123 - Table 7                │
│ Status: 🟢 READY ← Auto-updated     │
│ • 2x Cheeseburger ✓                 │
│ • 2x Fries ✓                        │
│ • 2x Coke ✓                         │
│                                     │
│ 🔔 READY TO SERVE!                  │
└─────────────────────────────────────┘
```

## 🎛️ Control Panel Features

### Station Filtering

Click any station to see only tickets for that station:

```
[ALL] [GRILL] [FRYER] [BARISTA] [COLD]
       ^^^^^^
     (Selected)

Shows only Grill tickets ↓

NEW          IN PROGRESS    READY
─────────────────────────────────
2x Burger    1x Steak       2x Ribs
1x Hotdog
```

### Auto-Refresh Toggle

```
┌────────────────────────────┐
│ ⏲️  Auto-Refresh: ON       │ ← Updates every 30s
└────────────────────────────┘

Click to turn off ↓

┌────────────────────────────┐
│ ⏲️  Auto-Refresh: OFF      │ ← Manual refresh only
└────────────────────────────┘
```

### Manual Refresh

```
┌──────────────┐
│ 🔄 Refresh   │ ← Click anytime to reload tickets
└──────────────┘
```

## 📱 Mobile Responsive

KDS works on tablets and phones:

```
TABLET VIEW:
┌─────────────────────────────────┐
│  NEW     │ IN PROG  │  READY   │
│ (3 cols) │          │          │
└─────────────────────────────────┘

PHONE VIEW:
┌───────────────┐
│     NEW       │
├───────────────┤
│  IN PROGRESS  │
├───────────────┤
│    READY      │
└───────────────┘
(Stacked vertically)
```

## 🎯 Quick Tips for Staff

### For Kitchen Staff

1. **Always check special instructions** (yellow highlight)
2. **Watch the time** - Red border = customer waiting too long
3. **Click "Start Prep" immediately** when you begin
4. **Mark "Ready" as soon as done** - don't wait
5. **Group orders** - Make all items for one table together

### For Expo/Server

1. **Ready column** shows complete orders ready to serve
2. **Bump entire order** when delivered to table
3. **Don't bump individual items** - bump the whole order
4. **Check Live Orders** to coordinate with front-of-house

## 🔧 Customization Examples

### Adding a Pizza Station

```sql
INSERT INTO kds_stations (venue_id, station_name, station_type, display_order, color_code)
VALUES ('your-venue-id', 'Pizza Oven', 'pizza', 5, '#ff6b6b');
```

Result:
```
[ALL] [GRILL] [FRYER] [BARISTA] [COLD] [🍕 PIZZA]
                                        ^^^^^^^^^^
                                      (New station)
```

### Auto-Route Pizza Items

```sql
INSERT INTO kds_station_categories (venue_id, station_id, menu_category)
VALUES ('your-venue-id', 'pizza-station-id', 'Pizza');
```

Now all "Pizza" category items automatically go to Pizza station!

## 📈 Performance Metrics

### What KDS Tracks

```
Per Ticket:
├─ Created: When order placed
├─ Started: When chef begins prep
├─ Ready: When food complete
└─ Bumped: When served

Calculated Metrics:
├─ Prep Time = Ready - Started
├─ Wait Time = Bumped - Ready
└─ Total Time = Bumped - Created
```

### Future Analytics (Coming Soon)

```
┌──────────────────────────────┐
│ STATION PERFORMANCE          │
├──────────────────────────────┤
│ Grill    Avg: 8m   Peak: 15m │
│ Fryer    Avg: 5m   Peak: 9m  │
│ Barista  Avg: 3m   Peak: 6m  │
└──────────────────────────────┘
```

## 🆘 Help & Support

### Common Questions

**Q: What if I accidentally click the wrong button?**
A: Click "Reset" to move back to "New" status

**Q: Can I see tickets from yesterday?**
A: No, KDS only shows today's active tickets

**Q: What happens to bumped tickets?**
A: They're hidden from KDS but stored in the database

**Q: Can multiple people use KDS at once?**
A: Yes! Updates sync in real-time across all screens

---

**Visual Guide Version:** 1.0  
**Last Updated:** October 9, 2025

