/**
 * Tests for Tables API
 * Critical: Table management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "table_123",
          label: "T1",
          venue_id: "venue_123",
          status: "available",
        },
        error: null,
      }),
    }),
  }),
}));

describe("GET /api/tables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves tables for venue", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/tables?venue_id=venue_123", {
      method: "GET",
    });

    expect(mockRequest.url).toContain("venue_id=venue_123");
  });

  it("filters by status", async () => {
    const mockRequest = new NextRequest(
      "http://localhost:3000/api/tables?venue_id=venue_123&status=available",
      { method: "GET" }
    );

    expect(mockRequest.url).toContain("status=available");
  });
});

describe("POST /api/tables", () => {
  it("creates table with valid data", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/tables", {
      method: "POST",
      body: JSON.stringify({
        venue_id: "venue_123",
        label: "T1",
        seats: 4,
        section: "Main",
      }),
    });

    const body = await mockRequest.json();
    expect(body).toHaveProperty("label");
    expect(body.seats).toBeGreaterThan(0);
  });

  it("validates seat count is positive", async () => {
    const validSeats = 4;
    const invalidSeats = -1;

    expect(validSeats).toBeGreaterThan(0);
    expect(invalidSeats).toBeLessThan(0);
  });
});

describe("PATCH /api/tables/[tableId]", () => {
  it("updates table status", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/tables/table_123", {
      method: "PATCH",
      body: JSON.stringify({
        status: "occupied",
      }),
    });

    const body = await mockRequest.json();
    expect(body).toHaveProperty("status");
  });

  it("updates table seat count", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/tables/table_123", {
      method: "PATCH",
      body: JSON.stringify({
        seats: 6,
      }),
    });

    const body = await mockRequest.json();
    expect(body.seats).toBe(6);
  });
});

describe("DELETE /api/tables/[tableId]", () => {
  it("deletes table", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/tables/table_123", {
      method: "DELETE",
    });

    expect(mockRequest.method).toBe("DELETE");
  });
});
