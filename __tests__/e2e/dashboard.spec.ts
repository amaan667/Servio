import { test, expect } from "@playwright/test";

test.describe("Dashboard E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto("/dashboard/venue-123");

    // Mock user session
    await page.evaluate(() => {
      localStorage.setItem(
        "user_session",
        JSON.stringify({
          user: { id: "user-123", email: "test@example.com" },
          access_token: "mock-token",
        })
      );
    });
  });

  test("should load dashboard with all sections", async ({ page }) => {
    await page.goto("/dashboard/venue-123");

    // Wait for dashboard to load
    await expect(page.locator("h1")).toContainText("Dashboard");

    // Check for main dashboard sections
    await expect(page.locator('[data-testid="stats-cards"]')).toBeVisible();
    await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-orders"]')).toBeVisible();
  });

  test("should navigate to different dashboard sections", async ({ page }) => {
    await page.goto("/dashboard/venue-123");

    // Test navigation to live orders
    await page.click('[data-testid="nav-live-orders"]');
    await expect(page).toHaveURL(/.*live-orders/);

    // Test navigation to menu management
    await page.click('[data-testid="nav-menu"]');
    await expect(page).toHaveURL(/.*menu-management/);

    // Test navigation to analytics
    await page.click('[data-testid="nav-analytics"]');
    await expect(page).toHaveURL(/.*analytics/);
  });

  test("should handle QR code generation", async ({ page }) => {
    await page.goto("/dashboard/venue-123/qr-codes");

    // Wait for QR codes page to load
    await expect(page.locator("h1")).toContainText("QR Code Generator");

    // Test QR code generation for tables
    await page.selectOption('[data-testid="qr-type-select"]', "tables");
    await page.fill('[data-testid="table-name-input"]', "Table 1");
    await page.click('[data-testid="generate-qr-button"]');

    // Verify QR code is generated
    await expect(page.locator('[data-testid="qr-code-canvas"]')).toBeVisible();
  });

  test("should handle order management", async ({ page }) => {
    await page.goto("/dashboard/venue-123/live-orders");

    // Wait for live orders page to load
    await expect(page.locator("h1")).toContainText("Live Orders");

    // Test order status updates
    await page.click('[data-testid="order-1"]');
    await page.click('[data-testid="mark-preparing"]');

    // Verify status change
    await expect(page.locator('[data-testid="order-1-status"]')).toContainText("Preparing");
  });

  test("should handle menu item management", async ({ page }) => {
    await page.goto("/dashboard/venue-123/menu-management");

    // Wait for menu management page to load
    await expect(page.locator("h1")).toContainText("Menu Management");

    // Test adding new menu item
    await page.click('[data-testid="add-menu-item"]');
    await page.fill('[data-testid="item-name"]', "Test Item");
    await page.fill('[data-testid="item-price"]', "9.99");
    await page.fill('[data-testid="item-description"]', "Test description");
    await page.click('[data-testid="save-item"]');

    // Verify item is added
    await expect(page.locator('[data-testid="menu-item-Test Item"]')).toBeVisible();
  });

  test("should handle responsive design", async ({ page }) => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/dashboard/venue-123");

    // Check mobile navigation
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();

    // Check tablet layout
    await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();

    // Check desktop layout
    await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();
  });

  test("should handle offline mode", async ({ page }) => {
    await page.goto("/dashboard/venue-123");

    // Simulate offline mode
    await page.context().setOffline(true);

    // Check offline banner appears
    await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();

    // Simulate back online
    await page.context().setOffline(false);

    // Check offline banner disappears
    await expect(page.locator('[data-testid="offline-banner"]')).not.toBeVisible();
  });
});
