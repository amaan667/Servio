// E2E tests for Stripe webhook processing infrastructure
// Full webhook processing tests require Stripe environment setup
// See __tests__/unit/stripe-webhook-processing.test.ts for logic tests

import { test, expect } from "@playwright/test";

test.describe("Stripe Payment Infrastructure", () => {
  test("payment endpoints are accessible", async ({ request }) => {
    // Test basic endpoint availability
    const endpoints = [
      "/api/stripe/create-checkout-session",
      "/api/stripe/checkout-session",
      "/api/stripe/reconcile",
      "/api/stripe/webhook",
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      // Should respond (may return 405 for wrong method, but should not be 404)
      expect(response.status()).not.toBe(404);
    }
  });

  test("order page loads correctly", async ({ page }) => {
    // Basic integration test for order/payment flow
    await page.goto("/order?venue=venue-demo&table=1");

    // Page should load without crashing
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  });
});
