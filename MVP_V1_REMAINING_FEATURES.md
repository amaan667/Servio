# MVP/V1 Remaining Features

## Status: What's Working ✅

1. **QR Ordering (Tables & Counter)** - ✅ Fully implemented
   - Table QR codes working
   - Counter QR codes working
   - Order creation and management

2. **Payment Methods** - ✅ Fully implemented
   - Pay Now (Stripe checkout)
   - Pay Later (deferred payment)
   - Pay at Till (offline payment)

3. **Staff Accounts** - ✅ Limits enforced
   - Starter: 5 staff (enforced)
   - Pro: 15 staff (enforced)
   - Enterprise: Unlimited

4. **KDS (Kitchen Display System)** - ✅ Tiered system implemented
   - Starter: Not included (add-on system needed)
   - Pro: Advanced KDS (multi-station) ✅
   - Enterprise: Enterprise KDS (multi-venue) ✅
   - Station limits enforced

5. **Table Management** - ✅ Limits enforced
   - Starter: 25 tables (enforced)
   - Pro: 100 tables (enforced)
   - Enterprise: Unlimited

6. **Locations/Venues** - ✅ Limits enforced
   - Starter: 1 location (enforced)
   - Pro: 3 locations (enforced)
   - Enterprise: Unlimited

7. **Analytics** - ✅ Partially implemented
   - Basic dashboard: ✅ Working
   - Advanced analytics: ✅ Working
   - CSV exports: ✅ Working (Pro+)
   - Financial exports: ⚠️ Not differentiated from CSV (Enterprise)

8. **Basic Branding** - ✅ Working
   - Logo upload: ✅ Working
   - Color themes: ✅ Working
   - All tiers have basic branding

---

## Missing for MVP/V1 🚧

### Critical (Must Have)

1. **Pickup Ordering** ✅ **ALREADY IMPLEMENTED**
   - **Status**: ✅ Working (implemented as "counter" orders)
   - **Pricing Claim**: "QR ordering (tables, counter, pickup)" - all tiers
   - **Implementation**: Counter orders (`source: "counter"`) are pickup orders
   - **Where it works**:
     - Counter orders appear in Live Orders with separate "Counter Orders" section
     - QR codes can be generated for counter/pickup orders
     - Orders are displayed alongside table orders in live orders view
     - Counter orders are identified by `source === "counter"` in the database
   - **Note**: "Pickup" and "counter" are the same thing - customers order at counter and pick up their food

2. **Loyalty Tracking UI/Dashboard** ⚠️
   - **Status**: Backend exists, no UI
   - **Pricing Claim**: Pro+ tier feature
   - **What's Needed**:
     - Create loyalty dashboard page
     - Display repeat customer metrics
     - Show top customers
     - Customer lifetime value tracking
   - **Files to Create/Update**:
     - `app/dashboard/[venueId]/loyalty/page.tsx` - New page
     - `app/dashboard/[venueId]/loyalty/page.client.tsx` - Client component
     - Use existing: `lib/ai/tools/customer-tools.ts` (analyzeRepeatCustomers)

3. **KDS Add-on System for Starter** ❌
   - **Status**: Not implemented
   - **Pricing Claim**: "KDS available as add-on" for Starter
   - **What's Needed**:
     - Stripe product for KDS add-on
     - Database schema for add-ons
     - UI to purchase/manage add-ons
     - Update tier checks to include add-ons
   - **Files to Create/Update**:
     - Database migration for `organization_addons` table
     - `app/api/addons/kds/route.ts` - Purchase endpoint
     - `app/dashboard/[venueId]/settings/addons/page.tsx` - Add-on management UI
     - `lib/tier-restrictions.ts` - Check add-ons in KDS access

### Important (Should Have)

4. **Custom Subdomain (Pro Tier)** ❌
   - **Status**: Not implemented
   - **Pricing Claim**: "Full branding + custom subdomain" for Pro
   - **What's Needed**:
     - Subdomain configuration UI
     - DNS/domain verification
     - Route subdomain requests to correct venue
     - Update middleware to handle subdomains
   - **Files to Create/Update**:
     - `app/dashboard/[venueId]/settings/branding/page.tsx` - Subdomain config
     - `middleware.ts` - Subdomain routing
     - Database: Add `custom_subdomain` to venues table
     - `lib/subdomain-helper.ts` - New helper for subdomain logic

5. **API Access UI/Key Management** ❌
   - **Status**: Not implemented
   - **Pricing Claim**: 
     - Pro: "API access available as add-on"
     - Enterprise: "API access, webhooks & POS/accounting integrations"
   - **What's Needed**:
     - API key generation UI
     - Key management dashboard
     - API documentation page
     - Rate limiting per key
     - Webhook configuration UI (Enterprise)
   - **Files to Create/Update**:
     - `app/dashboard/[venueId]/settings/api/page.tsx` - API management
     - `app/api/api-keys/route.ts` - Key CRUD endpoints
     - `lib/api-key-auth.ts` - API key authentication middleware
     - `app/docs/api/page.tsx` - API documentation

6. **API Add-on System for Pro** ❌
   - **Status**: Not implemented
   - **Pricing Claim**: "API access available as add-on" for Pro
   - **What's Needed**:
     - Same as KDS add-on system
     - Stripe product for API add-on
     - Purchase flow for Pro users

### Nice to Have (V2)

7. **White-label Custom Domains (Enterprise)** ❌
   - **Status**: Not implemented
   - **Pricing Claim**: "White-label + custom domains" for Enterprise
   - **What's Needed**:
     - Custom domain configuration
     - SSL certificate management
     - DNS verification
     - Domain routing
   - **Note**: This is complex and can be V2

8. **Financial Exports Differentiation** ⚠️
   - **Status**: CSV exports work, but not differentiated
   - **Pricing Claim**: Enterprise has "financial exports" (different from CSV)
   - **What's Needed**:
     - Define what "financial exports" means (XLSX? PDF? Accounting format?)
     - Implement Enterprise-specific export format
     - Update analytics export UI to show tier-specific options

---

## Implementation Priority

### Phase 1 (MVP Launch - Critical)
1. ✅ Pickup Ordering
2. ✅ Loyalty Tracking UI
3. ✅ KDS Add-on System

### Phase 2 (Post-Launch - Important)
4. Custom Subdomain (Pro)
5. API Access UI/Key Management
6. API Add-on System

### Phase 3 (V2)
7. White-label Custom Domains
8. Financial Exports Differentiation

---

## Notes

- **Support tiers** (Email/Priority/24/7) are marketing-only, no implementation needed
- **Inventory management** is already implemented for Pro+ tiers
- **Customer feedback** is already implemented for all tiers
- **AI Assistant** is Enterprise-only and already implemented
- **Multi-venue** is already working (Pro: 3, Enterprise: unlimited)

---

## Quick Wins (Can be done quickly)

1. **Loyalty Tracking UI**: ~3-4 hours
   - Backend already exists
   - Just need to create dashboard page and display data

2. **KDS Add-on Purchase Flow**: ~4-5 hours
   - Create Stripe product
   - Add purchase button in settings
   - Update tier checks to include add-ons

