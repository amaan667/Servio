import { test, expect } from '@playwright/test';

test.describe('Dashboard Flow', () => {
  test('should redirect to sign-in when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('should load homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Servio/i);
  });
});

test.describe('Public Pages', () => {
  test('should load home page', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should load terms page', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('text=/terms/i')).toBeVisible();
  });

  test('should load privacy page', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('text=/privacy/i')).toBeVisible();
  });
});

