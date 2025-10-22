# Converting ALL Feature Pages to Client-Side Auth

## Pages to Convert:
1. ✅ live-orders (DONE)
2. ✅ menu-management (DONE)
3. ✅ kds (DONE)
4. ✅ qr-codes (DONE)
5. ⏳ analytics
6. ⏳ billing  
7. ⏳ feedback
8. ⏳ inventory
9. ⏳ menu
10. ⏳ orders
11. ⏳ pos
12. ⏳ settings
13. ⏳ staff
14. ⏳ tables
15. ⏳ ai-chat

## Pattern:
- Create `page.client.tsx` with full auth logic
- Simplify `page.tsx` to thin wrapper
- Use `supabaseBrowser()` for client-side auth
- Add comprehensive logging

