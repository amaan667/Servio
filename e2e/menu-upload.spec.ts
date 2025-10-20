import { test, expect, type Page } from '@playwright/test';

test.describe('Menu Upload', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    // Navigate to menu management page
    await page.goto('/dashboard/venue-1/menu-management');
  });

  test('should upload PDF menu', async ({ page }: { page: Page }) => {
    // Wait for page to load
    await page.waitForSelector('text=Menu Management', { timeout: 10000 });

    // Find file input
    const fileInput = page.locator('input[type="file"]');
    
    // Upload PDF file
    await fileInput.setInputFiles({
      name: 'test-menu.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf content'),
    });

    // Wait for success message
    await expect(page.locator('text=Menu imported successfully')).toBeVisible({
      timeout: 30000,
    });
  });

  test('should display menu items after upload', async ({ page }: { page: Page }) => {
    // Wait for menu items to load
    await page.waitForSelector('[data-testid="menu-item"]', { timeout: 10000 });

    // Check if menu items are visible
    const menuItems = page.locator('[data-testid="menu-item"]');
    const count = await menuItems.count();
    
    expect(count).toBeGreaterThan(0);
  });

  test('should allow drag and drop reordering', async ({ page }: { page: Page }) => {
    // Wait for menu items
    await page.waitForSelector('[data-testid="menu-item"]', { timeout: 10000 });

    const firstItem = page.locator('[data-testid="menu-item"]').first();
    const secondItem = page.locator('[data-testid="menu-item"]').nth(1);

    // Get initial positions
    const firstPosition = await firstItem.boundingBox();
    const secondPosition = await secondItem.boundingBox();

    // Drag first item to second position
    await firstItem.dragTo(secondItem);

    // Wait for reordering animation
    await page.waitForTimeout(500);

    // Verify positions changed
    const newFirstPosition = await firstItem.boundingBox();
    const newSecondPosition = await secondItem.boundingBox();

    expect(newFirstPosition?.y).not.toBe(firstPosition?.y);
  });
});

