import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureTableExists, findDuplicateOrder } from "@/lib/api/orders/helpers";

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getSession: vi.fn(),
  },
} as unknown as Awaited<ReturnType<typeof import("@/lib/supabase").createClient>>;

describe("Order Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureTableExists", () => {
    it("should return existing table if found", async () => {
      const existingTable = { id: "table-123", venue_id: "venue-1", table_number: 5 };

      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: existingTable, error: null }),
            }),
          }),
        }),
      });

      const result = await ensureTableExists(mockSupabase, "venue-1", 5);

      expect(result.tableId).toBe("table-123");
      expect(result.autoCreated).toBe(false);
    });

    it("should create new table if not found", async () => {
      const newTable = { id: "table-new-123" };

      // First call: no existing table
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      // Second call: insert new table
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: newTable, error: null }),
          }),
        }),
      });

      const result = await ensureTableExists(mockSupabase, "venue-1", 10);

      expect(result.tableId).toBe("table-new-123");
      expect(result.autoCreated).toBe(true);
    });
  });

  describe("findDuplicateOrder", () => {
    it("should return null if no duplicate found", async () => {
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                gte: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await findDuplicateOrder(mockSupabase, "venue-1", "+44123456", 25.99);
      expect(result).toBeNull();
    });
  });
});
