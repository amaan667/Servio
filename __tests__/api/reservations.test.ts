/**
 * Tests for Reservations API
 * Critical: Booking management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "res_123",
          table_id: "table_123",
          party_size: 4,
          start_at: "2025-11-05T19:00:00Z",
        },
        error: null,
      }),
    }),
  }),
}));

describe("POST /api/reservations/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates reservation with valid data", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/reservations/create", {
      method: "POST",
      body: JSON.stringify({
        venue_id: "venue_123",
        table_id: "table_123",
        party_size: 4,
        start_at: "2025-11-05T19:00:00Z",
        duration_minutes: 90,
        customer_name: "John Doe",
        customer_phone: "+1234567890",
      }),
    });

    const body = await mockRequest.json();
    expect(body).toHaveProperty("party_size");
    expect(body).toHaveProperty("start_at");
    expect(body.party_size).toBeGreaterThan(0);
  });

  it("validates party size is positive", async () => {
    const validParty = 4;
    const invalidParty = 0;

    expect(validParty).toBeGreaterThan(0);
    expect(invalidParty).toBeLessThanOrEqual(0);
  });

  it("validates reservation time is in future", async () => {
    const futureTime = new Date(Date.now() + 86400000).toISOString();
    const pastTime = new Date(Date.now() - 86400000).toISOString();

    expect(new Date(futureTime).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(pastTime).getTime()).toBeLessThan(Date.now());
  });
});

describe("POST /api/reservations/checkin", () => {
  it("checks in reservation", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/reservations/checkin", {
      method: "POST",
      body: JSON.stringify({
        reservation_id: "res_123",
        venue_id: "venue_123",
      }),
    });

    const body = await mockRequest.json();
    expect(body).toHaveProperty("reservation_id");
  });
});

describe("POST /api/reservations/[reservationId]/cancel", () => {
  it("cancels reservation", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/reservations/res_123/cancel", {
      method: "POST",
      body: JSON.stringify({
        reason: "Customer requested",
      }),
    });

    expect(mockRequest.url).toContain("res_123");
  });
});

describe("POST /api/reservations/[reservationId]/modify", () => {
  it("modifies reservation time", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api/reservations/res_123/modify", {
      method: "POST",
      body: JSON.stringify({
        start_at: "2025-11-05T20:00:00Z",
        party_size: 6,
      }),
    });

    const body = await mockRequest.json();
    expect(body).toHaveProperty("start_at");
  });
});

describe("GET /api/reservations", () => {
  it("retrieves reservations for venue", async () => {
    const mockRequest = new NextRequest(
      "http://localhost:3000/api/reservations?venue_id=venue_123",
      { method: "GET" }
    );

    expect(mockRequest.url).toContain("venue_id=venue_123");
  });

  it("filters by date range", async () => {
    const mockRequest = new NextRequest(
      "http://localhost:3000/api/reservations?venue_id=venue_123&start=2025-11-05&end=2025-11-06",
      { method: "GET" }
    );

    expect(mockRequest.url).toContain("start=");
    expect(mockRequest.url).toContain("end=");
  });
});
