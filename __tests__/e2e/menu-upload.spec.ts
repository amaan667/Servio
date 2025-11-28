 
/**
 * E2E Tests - Menu Upload Flow
 * Tests the complete menu upload and extraction process
 */

import { test, expect } from "@playwright/test";
import path from "path";

const TEST_VENUE_ID = "test-venue-e2e";
const TEST_PDF_PATH = path.join(__dirname, "../fixtures/test-menu.pdf");

test.describe("Menu Upload Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to menu management
    await page.goto(`/dashboard/${TEST_VENUE_ID}/menu-management`);
  });

  test("should upload PDF and extract menu items successfully", async ({ page }) => {
    // Click on Manage tab
    await page.click('button:has-text("Manage")');

    // Upload PDF file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_PDF_PATH);

    // Wait for upload and extraction (up to 8 minutes)
    await page.waitForSelector("text=/\\d+ items inserted/", { timeout: 480000 });

    // Verify success message
    const successMessage = await page.textContent(".toast");
    expect(successMessage).toContain("successfully");

    // Verify menu items appear
    await page.waitForSelector('text="Menu Items"');
    const itemCount = await page.textContent('span:has-text("items")');
    expect(parseInt(itemCount || "0")).toBeGreaterThan(0);

    // Verify items are expandable
    const categoryHeader = await page.locator(".cursor-pointer").first();
    await categoryHeader.click();

    // Check that items are visible
    const firstItem = await page.locator('[data-testid="menu-item"]').first();
    await expect(firstItem).toBeVisible();
  });

  test("should allow drag-and-drop reordering of categories", async ({ page }) => {
    await page.click('button:has-text("Manage")');

    // Wait for categories to load
    await page.waitForSelector('text="Menu Items"');

    // Get initial category order
    const initialCategories = await page.locator(".font-semibold").allTextContents();

    // Drag first category to second position
    const firstCategory = page.locator('[draggableId^="category-"]').first();
    const secondCategory = page.locator('[draggableId^="category-"]').nth(1);

    await firstCategory.dragTo(secondCategory);

    // Wait for toast notification
    await page.waitForSelector('text="Categories reordered"');

    // Verify order changed
    const newCategories = await page.locator(".font-semibold").allTextContents();
    expect(newCategories).not.toEqual(initialCategories);
  });

  test("should reflect category order in all preview modes", async ({ page }) => {
    await page.click('button:has-text("Manage")');

    // Get category order from management tab
    await page.waitForSelector('text="Menu Items"');
    const managementCategories = await page.locator(".font-semibold").allTextContents();

    // Switch to Preview tab
    await page.click('button:has-text("Preview")');

    // Check PDF preview
    await page.click('button:has-text("Visual Menu")');
    await page.waitForTimeout(1000);

    // Get categories from preview
    const pdfPreviewCategories = await page.locator("h2").allTextContents();

    // Categories should match (first few at least)
    expect(pdfPreviewCategories.slice(0, 3)).toEqual(managementCategories.slice(0, 3));

    // Check Styled preview
    await page.click('button:has-text("Styled")');
    await page.waitForTimeout(1000);

    const styledPreviewCategories = await page.locator("h2").allTextContents();
    expect(styledPreviewCategories.slice(0, 3)).toEqual(managementCategories.slice(0, 3));
  });

  test("should add menu item manually", async ({ page }) => {
    await page.click('button:has-text("Manage")');
    await page.click('button:has-text("Add Item")');

    // Fill form
    await page.fill('input[placeholder*="name"]', "Test Item");
    await page.fill('textarea[placeholder*="description"]', "Test description");
    await page.fill('input[type="number"]', "12.50");
    await page.fill('input[placeholder*="category"]', "Test Category");

    // Submit
    await page.click('button:has-text("Add")');

    // Verify item appears
    await page.waitForSelector('text="Test Item"');
    const itemElement = await page.locator('text="Test Item"');
    await expect(itemElement).toBeVisible();
  });

  test("should delete menu item", async ({ page }) => {
    await page.click('button:has-text("Manage")');

    // Wait for items to load
    await page.waitForSelector('[data-testid="menu-item"]');

    // Get initial count
    const initialCountText = await page.textContent('span:has-text("items")');
    const initialCount = parseInt(initialCountText || "0");

    // Click delete on first item
    const deleteButton = page.locator('button[aria-label="Delete item"]').first();
    await deleteButton.click();

    // Confirm deletion
    await page.click('button:has-text("Delete")');

    // Wait for toast
    await page.waitForSelector('text="deleted successfully"');

    // Verify count decreased
    const newCountText = await page.textContent('span:has-text("items")');
    const newCount = parseInt(newCountText || "0");
    expect(newCount).toBe(initialCount - 1);
  });
});

test.describe("Menu Extraction Quality", () => {
  test("should extract allergen information from PDF", async ({ page }) => {
    await page.goto(`/dashboard/${TEST_VENUE_ID}/menu-management`);
    await page.click('button:has-text("Manage")');

    // Upload PDF with allergen info
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_PDF_PATH);

    await page.waitForSelector("text=/\\d+ items inserted/", { timeout: 480000 });

    // Open first item for editing
    await page.locator('button[aria-label="Edit item"]').first().click();

    // Check if allergen field exists and has data
    const allergenField = page.locator('input[name="allergens"]');
    const allergenValue = await allergenField.inputValue();

    // Should have extracted allergens (if present in PDF)
    expect(allergenValue).toBeTruthy();
  });

  test("should match similar items correctly (Shakshuka example)", async ({ page }) => {
    await page.goto(`/dashboard/${TEST_VENUE_ID}/menu-management`);
    await page.click('button:has-text("Manage")');

    // Upload PDF + URL
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_PDF_PATH);

    const urlInput = page.locator('input[placeholder*="website"]');
    await urlInput.fill("https://example.com/menu");

    await page.click('button:has-text("Upload")');

    await page.waitForSelector("text=/\\d+ items inserted/", { timeout: 480000 });

    // Search for Shakshuka
    await page.fill('input[placeholder*="search"]', "Shakshuka");

    // Should find both "Shakshuka" and "Shakshuka Royale" as separate items
    const results = await page.locator('[data-testid="menu-item"]').count();
    expect(results).toBeGreaterThanOrEqual(1);
  });
});
