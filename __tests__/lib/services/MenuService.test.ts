/**
 * MenuService Tests
 * Tests for menu service methods
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MenuService } from "@/lib/services/MenuService";
import { createSupabaseClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: vi.fn(),
}));

describe("MenuService", () => {
  let menuService: MenuService;
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    menuService = new MenuService();
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  { id: "item-1", name: "Burger", category: "Mains", price: 15.99 },
                  { id: "item-2", name: "Fries", category: "Sides", price: 5.99 },
                ],
                error: null,
              }),
            })),
          })),
        })),
      })),
    };
    vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase as unknown as ReturnType<typeof createSupabaseClient>);
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

      mockSupabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockVenue, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
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
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockUpload, error: null }),
                }),
              }),
            }),
          }),
        });

      const result = await menuService.getPublicMenuFull("venue-1", { limit: 10, offset: 0 });

      expect(result).toBeDefined();
      expect(result.venue).toBeDefined();
      expect(result.menuItems).toBeDefined();
      expect(result.pagination).toBeDefined();
    });
  });
});
