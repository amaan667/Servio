import { test, expect } from "@playwright/test";

test.describe("Menu Management", () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as venue owner
    await page.goto("/sign-in");
    await page.fill('[name="email"]', "owner@test.com");
    await page.fill('[name="password"]', "testpassword");
    await page.click('[type="submit"]');
    await page.waitForURL("/dashboard/**");
  });

  test("CRUD operations on menu items", async ({ page }) => {
    await page.goto("/dashboard/venue-demo/menu-management");

    // CREATE
    await page.click('[data-testid="add-item"]');
    await page.fill('[name="name"]', "Test Pizza");
    await page.fill('[name="price"]', "15.99");
    await page.click('[data-testid="save"]');
    await expect(page.locator("text=Test Pizza")).toBeVisible();

    // UPDATE
    await page.click('[data-testid="edit-Test Pizza"]');
    await page.fill('[name="price"]', "16.99");
    await page.click('[data-testid="save"]');
    await expect(page.locator("text=£16.99")).toBeVisible();

    // DELETE
    await page.click('[data-testid="delete-Test Pizza"]');
    await page.click('[data-testid="confirm-delete"]');
    await expect(page.locator("text=Test Pizza")).not.toBeVisible();
  });

  test("can organize items by categories", async ({ page }) => {
    await page.goto("/dashboard/venue-demo/menu-management");

    // Add new category
    await page.click('[data-testid="add-category"]');
    await page.fill('[name="category_name"]', "Desserts");
    await page.click('[data-testid="save-category"]');

    // Drag item to new category
    const item = page.locator('[data-testid="menu-item-Ice Cream"]');
    const category = page.locator('[data-testid="category-Desserts"]');

    await item.dragTo(category);

    // Verify item moved
    await expect(category.locator("text=Ice Cream")).toBeVisible();
  });
});
