/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Integration Tests - Menu API Endpoints
 * Tests API routes for menu management
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TEST_VENUE_ID = "test-venue-api";

describe("Menu API Integration Tests", () => {
  describe("GET /api/menu/[venueId]", () => {
    it("should return menu items for valid venue", async () => {
      const response = await fetch(`${BASE_URL}/api/menu/${TEST_VENUE_ID}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("menuItems");
      expect(Array.isArray(data.menuItems)).toBe(true);
    });

    it("should return 404 for non-existent venue", async () => {
      const response = await fetch(`${BASE_URL}/api/menu/non-existent-venue`);

      expect(response.status).toBe(404);
    });

    it("should include category order in response", async () => {
      const response = await fetch(`${BASE_URL}/api/menu/${TEST_VENUE_ID}`);
      const data = await response.json();

      expect(data).toHaveProperty("categoryOrder");
    });
  });

  describe("POST /api/catalog/replace", () => {
    it("should accept PDF upload and extract items", async () => {
      const formData = new FormData();
      // Add test PDF file
      const blob = new Blob(["test pdf content"], { type: "application/pdf" });
      formData.append("file", blob, "test-menu.pdf");
      formData.append("venueId", TEST_VENUE_ID);
      formData.append("replaceMode", "true");

      const response = await fetch(`${BASE_URL}/api/catalog/replace`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("ok", true);
      expect(data).toHaveProperty("itemCount");
    });

    it("should handle hybrid mode (PDF + URL)", async () => {
      const formData = new FormData();
      const blob = new Blob(["test pdf content"], { type: "application/pdf" });
      formData.append("file", blob, "test-menu.pdf");
      formData.append("venueId", TEST_VENUE_ID);
      formData.append("menuUrl", "https://example.com/menu");
      formData.append("replaceMode", "true");

      const response = await fetch(`${BASE_URL}/api/catalog/replace`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("mode", "hybrid");
    });

    it("should enforce rate limiting for uploads", async () => {
      // Make 6 rapid uploads (limit is 5 per 5 minutes)
      const promises = Array(6)
        .fill(null)
        .map(() => {
          const formData = new FormData();
          const blob = new Blob(["test"], { type: "application/pdf" });
          formData.append("file", blob, "test.pdf");
          formData.append("venueId", TEST_VENUE_ID);

          return fetch(`${BASE_URL}/api/catalog/replace`, {
            method: "POST",
            body: formData,
          });
        });

      const responses = await Promise.all(promises);

      // Last request should be rate limited
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
    });
  });

  describe("POST /api/menu/categories", () => {
    it("should add new category", async () => {
      const response = await fetch(`${BASE_URL}/api/menu/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: TEST_VENUE_ID,
          categoryName: "New Category",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("success", true);
    });

    it("should prevent duplicate categories", async () => {
      // Add category twice
      await fetch(`${BASE_URL}/api/menu/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: TEST_VENUE_ID,
          categoryName: "Duplicate Category",
        }),
      });

      const response = await fetch(`${BASE_URL}/api/menu/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: TEST_VENUE_ID,
          categoryName: "Duplicate Category",
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/menu/categories", () => {
    it("should update category order", async () => {
      const newOrder = ["Desserts", "Mains", "Starters"];

      const response = await fetch(`${BASE_URL}/api/menu/categories`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: TEST_VENUE_ID,
          categories: newOrder,
        }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe("Performance", () => {
    it("should return cached menu data within 100ms", async () => {
      // First request (cache miss)
      await fetch(`${BASE_URL}/api/menu/${TEST_VENUE_ID}`);

      // Second request (cache hit)
      const start = Date.now();
      await fetch(`${BASE_URL}/api/menu/${TEST_VENUE_ID}`);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});

describe("Error Handling", () => {
  it("should return proper error for missing venueId", async () => {
    const response = await fetch(`${BASE_URL}/api/catalog/replace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  it("should handle large PDF gracefully (10MB limit)", async () => {
    const formData = new FormData();
    // Create 11MB blob (exceeds limit)
    const largeBlob = new Blob([new ArrayBuffer(11 * 1024 * 1024)], {
      type: "application/pdf",
    });
    formData.append("file", largeBlob, "large.pdf");
    formData.append("venueId", TEST_VENUE_ID);

    const response = await fetch(`${BASE_URL}/api/catalog/replace`, {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(400);
  });
});
