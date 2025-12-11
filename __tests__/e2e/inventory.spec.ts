import { test, expect } from "@playwright/test";

test.describe("Inventory Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
    await page.fill('[name="email"]', "owner@test.com");
    await page.fill('[name="password"]', "testpassword");
    await page.click('[type="submit"]');
  });

  test("can add and track ingredients", async ({ page }) => {
    await page.goto("/dashboard/venue-demo/inventory");

    // Add ingredient
    await page.click('[data-testid="add-ingredient"]');
    await page.fill('[name="name"]', "Tomatoes");
    await page.fill('[name="unit"]', "kg");
    await page.fill('[name="cost_per_unit"]', "3.50");
    await page.fill('[name="on_hand"]', "25");
    await page.fill('[name="par_level"]', "50");
    await page.click('[data-testid="save-ingredient"]');

    await expect(page.locator("text=Tomatoes")).toBeVisible();
  });

  test("low stock alerts appear", async ({ page }) => {
    await page.goto("/dashboard/venue-demo/inventory");

    // Should show low stock warning for items below par level
    await expect(page.locator('[data-testid="low-stock-alert"]')).toBeVisible();
  });

  test("can import inventory from CSV", async ({ page }) => {
    await page.goto("/dashboard/venue-demo/inventory");

    await page.click('[data-testid="import-csv"]');

    // Upload CSV file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("__tests__/fixtures/inventory.csv");

    await page.click('[data-testid="process-import"]');

    // Verify success message
    await expect(page.locator("text=items imported")).toBeVisible({ timeout: 10000 });
  });
});
