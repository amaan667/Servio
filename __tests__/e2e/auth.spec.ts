import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should load sign-in page", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveTitle(/Servio/i);
    await expect(page.locator("h1")).toContainText(/sign in/i);
  });

  test("should show validation errors for empty form", async ({ page }) => {
    await page.goto("/sign-in");

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Should show validation errors
    await expect(page.locator("text=/email/i")).toBeVisible();
  });

  test("should navigate to sign-up page", async ({ page }) => {
    await page.goto("/sign-in");
    await page.click("text=/sign up/i");
    await expect(page).toHaveURL(/sign-up/);
  });
});
