MVP Test Checklist
==================

- Active Tables stays unchanged when marking a previous day order as Served.
- Mark today's last Preparing → Served → Active Tables decrements to 0.
- Tabs:
  - Preparing/Served/Paid show only today.
  - All shows historical.
- Stripe test checkout:
  - Checkout session creates.
  - Webhook flips payment_status=paid.
- Review modal posts to /api/reviews/add and appears in /api/reviews/list?venueId=...
- Dark mode toggles across pages.
- Menu upload page has no debug noise.


