import { test, expect } from "@playwright/test";

test.describe("Complete Order Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Create test venue and menu
    await page.goto("/");
  });

  test("customer can browse menu and place order", async ({ page }) => {
    // Navigate to test venue
    await page.goto("/order?venue=venue-demo&table=5");

    // Wait for menu to load
    await expect(page.locator('[data-testid="menu-container"]')).toBeVisible({ timeout: 10000 });

    // Select menu items
    const firstItem = page.locator('[data-testid^="menu-item-"]').first();
    await firstItem.click();

    // Add to cart
    await page.click('[data-testid="add-to-cart"]');
    await expect(page.locator('[data-testid="cart-count"]')).toContainText("1");

    // Proceed to checkout
    await page.click('[data-testid="view-cart"]');
    await page.click('[data-testid="checkout-button"]');

    // Fill in customer details
    await page.fill('[name="customer_name"]', "E2E Test Customer");
    await page.fill('[name="customer_phone"]', "+441234567890");
    await page.fill('[name="customer_email"]', "test@example.com");

    // Submit order (assuming pay later option)
    await page.click('[data-testid="submit-order"]');

    // Verify success page
    await expect(page.locator('[data-testid="order-success"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="order-number"]')).toContainText("ORD-");

    // Verify tracking link works
    const trackingLink = page.locator('[data-testid="track-order"]');
    await expect(trackingLink).toBeVisible();
  });

  test("order appears in dashboard live orders", async ({ page, context }) => {
    // Create order in first tab
    await page.goto("/order?venue=venue-demo&table=10");
    // ... place order ...

    // Open dashboard in new tab
    const dashboardPage = await context.newPage();
    await dashboardPage.goto("/sign-in");

    // Sign in as venue owner
    await dashboardPage.fill('[name="email"]', "owner@test.com");
    await dashboardPage.fill('[name="password"]', "testpassword");
    await dashboardPage.click('[type="submit"]');

    // Navigate to live orders
    await dashboardPage.goto("/dashboard/venue-demo/live-orders");

    // Verify order appears
    await expect(dashboardPage.locator('[data-testid="order-card"]')).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("KDS Workflow", () => {
  test("kitchen staff can manage tickets", async ({ page }) => {
    // Sign in as kitchen staff
    await page.goto("/sign-in");
    await page.fill('[name="email"]', "kitchen@test.com");
    await page.fill('[name="password"]', "testpassword");
    await page.click('[type="submit"]');

    // Navigate to KDS
    await page.goto("/dashboard/venue-demo/kds");

    // Wait for tickets to load
    await expect(page.locator('[data-testid="kds-ticket"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Mark ticket as in progress
    const firstTicket = page.locator('[data-testid="kds-ticket"]').first();
    await firstTicket.locator('[data-testid="status-in-progress"]').click();

    // Verify status updated
    await expect(firstTicket.locator('[data-testid="ticket-status"]')).toContainText("In Progress");

    // Mark as ready
    await firstTicket.locator('[data-testid="status-ready"]').click();
    await expect(firstTicket.locator('[data-testid="ticket-status"]')).toContainText("Ready");
  });
});

test.describe("Payment Flow", () => {
  test("customer can complete Stripe payment", async ({ page }) => {
    await page.goto("/order?venue=venue-demo&table=15");

    // Add items and checkout
    // ... (similar to order flow)

    // Select Stripe payment
    await page.click('[data-testid="payment-method-stripe"]');
    await page.click('[data-testid="submit-order"]');

    // Should redirect to Stripe
    await expect(page).toHaveURL(/checkout.stripe.com/, { timeout: 10000 });

    // In test mode, use Stripe test cards
    // Note: Actual Stripe testing requires Stripe CLI or test mode
  });
});

test.describe("Menu Management", () => {
  test("owner can add menu item", async ({ page }) => {
    // Sign in as owner
    await page.goto("/sign-in");
    await page.fill('[name="email"]', "owner@test.com");
    await page.fill('[name="password"]', "testpassword");
    await page.click('[type="submit"]');

    // Navigate to menu management
    await page.goto("/dashboard/venue-demo/menu-management");

    // Click add item
    await page.click('[data-testid="add-menu-item"]');

    // Fill in form
    await page.fill('[name="name"]', "E2E Test Burger");
    await page.fill('[name="price"]', "12.99");
    await page.fill('[name="description"]', "Delicious test burger");
    await page.selectOption('[name="category"]', "Mains");

    // Submit
    await page.click('[data-testid="save-menu-item"]');

    // Verify item appears in list
    await expect(page.locator("text=E2E Test Burger")).toBeVisible({ timeout: 5000 });
  });

  test("owner can upload menu PDF", async ({ page }) => {
    await page.goto("/dashboard/venue-demo/menu-management");

    // Upload PDF
    await page.click('[data-testid="upload-menu-pdf"]');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("__tests__/fixtures/sample-menu.pdf");

    await page.click('[data-testid="process-pdf"]');

    // Wait for AI processing
    await expect(page.locator('[data-testid="processing-complete"]')).toBeVisible({
      timeout: 30000,
    });
  });
});

test.describe("Staff Management", () => {
  test("owner can invite staff", async ({ page }) => {
    await page.goto("/dashboard/venue-demo/staff");

    await page.click('[data-testid="invite-staff"]');
    await page.fill('[name="email"]', "newstaff@test.com");
    await page.selectOption('[name="role"]', "waiter");
    await page.click('[data-testid="send-invitation"]');

    await expect(page.locator("text=Invitation sent")).toBeVisible();
  });
});

test.describe("Real-time Updates", () => {
  test("order updates appear in real-time", async ({ page, context }) => {
    // Open two tabs - customer and dashboard
    const dashboardPage = await context.newPage();

    // Dashboard: Sign in and go to live orders
    await dashboardPage.goto("/sign-in");
    // ... sign in ...
    await dashboardPage.goto("/dashboard/venue-demo/live-orders");

    // Customer: Place order
    await page.goto("/order?venue=venue-demo&table=20");
    // ... place order ...

    // Dashboard should show order in real-time
    await expect(dashboardPage.locator('[data-testid="new-order-notification"]')).toBeVisible({
      timeout: 5000,
    });
  });
});
