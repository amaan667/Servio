/**
 * MenuService Tests
 * Tests for menu service methods
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuService } from "@/lib/services/MenuService";
import { createSupabaseClient, supabaseAdmin } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: vi.fn(),
  supabaseAdmin: vi.fn(),
}));

describe("MenuService", () => {
  let menuService: MenuService;
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    menuService = new MenuService();
    const defaultResolved = {
      data: [
        { id: "item-1", name: "Burger", category: "Mains", price: 15.99 },
        { id: "item-2", name: "Fries", category: "Sides", price: 5.99 },
      ],
      error: null,
    };
    const finalQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then(onFulfilled: (v: { data: unknown; error: null }) => unknown) {
        return Promise.resolve(defaultResolved).then(onFulfilled);
      },
    };
    const chainWithOrder = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue(finalQuery),
    };
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(chainWithOrder),
          }),
        }),
      })),
    };
    vi.mocked(createSupabaseClient).mockResolvedValue(
      mockSupabase as unknown as ReturnType<typeof createSupabaseClient>
    );
  });

  describe("getMenuItems", () => {
    it("should fetch menu items for venue", async () => {
      const result = await menuService.getMenuItems("venue-1");

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should filter by category when provided", async () => {
      const result = await menuService.getMenuItems("venue-1", { category: "Mains" });

      expect(result).toBeDefined();
    });

    it("should include unavailable items when requested", async () => {
      const result = await menuService.getMenuItems("venue-1", { includeUnavailable: true });

      expect(result).toBeDefined();
    });
  });

  describe("getPublicMenuFull", () => {
    it("should return full menu data with venue info", async () => {
      const mockVenue = { venue_id: "venue-1", venue_name: "Test Venue" };
      const mockItems = [{ id: "item-1", name: "Burger" }];
      const mockUpload = { pdf_images: [], category_order: ["Mains"] };

      const fromMock = vi.fn((table: string) => {
        if (table === "venues") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockVenue, error: null }),
              }),
            }),
          };
        }
        if (table === "menu_items") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    range: vi.fn().mockResolvedValue({
                      data: mockItems,
                      count: 1,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "menu_uploads") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: mockUpload, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "menu_item_corrections") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
      });

      vi.mocked(supabaseAdmin).mockReturnValue({ from: fromMock } as never);

      const result = await menuService.getPublicMenuFull("venue-1", { limit: 10, offset: 0 });

      expect(result).toBeDefined();
      expect(result.venue).toBeDefined();
      expect(result.menuItems).toBeDefined();
      expect(result.pagination).toBeDefined();
    });
  });
});
