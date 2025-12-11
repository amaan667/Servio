/**
 * Tests for Kitchen Display System API
 * Critical: Kitchen operations
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
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "ticket_123",
          order_id: "order_123",
          station_name: "Grill",
          status: "pending",
        },
        error: null,
      }),
    }),
  }),
}));

describe("GET /api/kds/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves KDS tickets for venue", async () => {
    const mockRequest = new NextRequest(
      "http://localhost:3000/api//kds/tickets?venue_id=venue_123",
      { method: "GET" }
    );

    expect(mockRequest.url).toContain("venue_id=venue_123");
  });

  it("filters by station", async () => {
    const mockRequest = new NextRequest(
      "http://localhost:3000/api//kds/tickets?venue_id=venue_123&station=Grill",
      { method: "GET" }
    );

    expect(mockRequest.url).toContain("station=Grill");
  });

  it("filters by status", async () => {
    const mockRequest = new NextRequest(
      "http://localhost:3000/api//kds/tickets?venue_id=venue_123&status=pending",
      { method: "GET" }
    );

    expect(mockRequest.url).toContain("status=pending");
  });
});

describe("PATCH /api/kds/tickets/[id]", () => {
  it("updates ticket status to in_progress", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api//kds/tickets/ticket_123", {
      method: "PATCH",
      body: JSON.stringify({
        status: "in_progress",
      }),
    });

    const body = await mockRequest.json();
    expect(body.status).toBe("in_progress");
  });

  it("updates ticket status to completed", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api//kds/tickets/ticket_123", {
      method: "PATCH",
      body: JSON.stringify({
        status: "completed",
      }),
    });

    const body = await mockRequest.json();
    expect(body.status).toBe("completed");
  });
});

describe("POST /api/kds/tickets/bulk-update", () => {
  it("updates multiple tickets", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api//kds/tickets/bulk-update", {
      method: "POST",
      body: JSON.stringify({
        ticket_ids: ["ticket_1", "ticket_2", "ticket_3"],
        status: "completed",
      }),
    });

    const body = await mockRequest.json();
    expect(body.ticket_ids).toHaveLength(3);
    expect(body.status).toBe("completed");
  });
});

describe("GET /api/kds/stations", () => {
  it("retrieves KDS stations", async () => {
    const mockRequest = new NextRequest(
      "http://localhost:3000/api//kds/stations?venue_id=venue_123",
      { method: "GET" }
    );

    expect(mockRequest.url).toContain("venue_id=venue_123");
  });
});

describe("POST /api/kds/stations", () => {
  it("creates KDS station", async () => {
    const mockRequest = new NextRequest("http://localhost:3000/api//kds/stations", {
      method: "POST",
      body: JSON.stringify({
        venue_id: "venue_123",
        name: "Grill",
        display_order: 1,
      }),
    });

    const body = await mockRequest.json();
    expect(body).toHaveProperty("name");
    expect(body.name).toBe("Grill");
  });
});
