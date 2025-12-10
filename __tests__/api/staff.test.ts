 
/**
 * Staff Management API Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest, parseJsonResponse } from "../helpers/api-test-helpers";
import { GET as listGet } from "@/app/api/staff/list/route";
import { POST as addPost } from "@/app/api/staff/add/route";
import { POST as deletePost } from "@/app/api/staff/delete/route";

interface StaffRecord {
  id: string;
  name: string;
  role: string;
  venue_id: string;
  deleted_at?: string | null;
}

let listResponse: { data: StaffRecord[] | null; error: { message: string } | null };
let insertResponse: { data: StaffRecord[] | null; error: { message: string } | null };
let deleteResponse: { data: StaffRecord[] | null; error: { message: string } | null };

const createStaffQueryBuilder = () => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      is: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve(listResponse)),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    select: vi.fn(() => Promise.resolve(insertResponse)),
  })),
  update: vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve(deleteResponse)),
      })),
    })),
  })),
});

const mockSupabaseClient = {
  from: vi.fn(() => createStaffQueryBuilder()),
};

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

describe("Staff API Routes", () => {
  const venueId = "venue-test-123";
  const venueQuery = `http://localhost:3000/api//staff/list?venueId=${venueId}`;

  beforeEach(() => {
    vi.clearAllMocks();
    listResponse = { data: [], error: null };
    insertResponse = { data: [{ id: "staff-1", name: "Alice", role: "Server", venue_id: venueId }], error: null };
    deleteResponse = { data: [{ id: "staff-1", name: "Alice", role: "Server", venue_id: venueId, deleted_at: new Date().toISOString() }], error: null };
  });

  describe("GET /api/staff/list", () => {
    it("should require authentication", async () => {
      const request = createMockRequest("GET", venueQuery, {
        headers: { "x-test-auth": "none" },
      });
      const response = await listGet(request);
      expect(response.status).toBe(401);
    });

    it("should return staff list for authenticated user", async () => {
      const staffRecords: StaffRecord[] = [
        { id: "staff-1", name: "Alice", role: "Server", venue_id: venueId },
        { id: "staff-2", name: "Bob", role: "Manager", venue_id: venueId },
      ];
      listResponse = { data: staffRecords, error: null };

      const request = createMockRequest("GET", venueQuery);

      const response = await listGet(request);
      expect(response.status).toBe(200);
      const data = await parseJsonResponse(response);
      expect(data.data?.staff).toHaveLength(2);
    });

    it("should require venueId parameter", async () => {
      const request = createMockRequest("GET", "http://localhost:3000/api//staff/list", {
        headers: { "x-test-auth": "passthrough" },
      });

      const response = await listGet(request);
      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/staff/add", () => {
    it("should require authentication", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api//staff/add", {
        headers: { "x-test-auth": "none" },
        body: {
          venueId,
          name: "Test Staff",
          role: "server",
        },
      });

      const response = await addPost(request);
      expect(response.status).toBe(401);
    });

    it("should validate required fields", async () => {
      const request = createMockRequest("POST", "http://localhost:3000/api//staff/add", {
        body: {
          venueId,
        },
      });

      const response = await addPost(request);
      expect(response.status).toBe(400);
    });

    it("should create staff record", async () => {
      const request = createMockRequest(
        "POST",
        `http://localhost:3000/api//staff/add?venueId=${venueId}`,
        {
          body: {
            venueId,
            name: "Test Staff",
            role: "server",
          },
        }
      );

      const response = await addPost(request);
      const data = await parseJsonResponse(response);
      expect(response.status).toBe(200);
      expect(data.data?.name).toBe("Alice");
    });
  });

  describe("POST /api/staff/delete", () => {
    const deleteUrl = "http://localhost:3000/api//staff/delete";

    it("should require authentication", async () => {
      const request = createMockRequest("POST", deleteUrl, {
        headers: { "x-test-auth": "none" },
        body: {
          venueId,
          id: "staff-1",
        },
      });

      const response = await deletePost(request);
      expect(response.status).toBe(401);
    });

    it("should validate required fields", async () => {
      const request = createMockRequest("POST", deleteUrl, {
        body: {
          venueId,
        },
      });

      const response = await deletePost(request);
      expect(response.status).toBe(400);
    });

    it("should soft delete staff", async () => {
      const request = createMockRequest(
        "POST",
        `${deleteUrl}?venueId=${venueId}`,
        {
          body: {
            venueId,
            id: "staff-1",
          },
        }
      );

      const response = await deletePost(request);
      const data = await parseJsonResponse(response);
      expect(response.status).toBe(200);
      expect(data.data?.success).toBe(true);
    });
  });
});
