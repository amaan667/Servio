/**
 * @fileoverview Unit tests for MenuService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MenuService } from "@/lib/services/MenuService";
import { createSupabaseClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: vi.fn(),
}));

describe("MenuService", () => {
  let menuService: MenuService;
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    menuService = new MenuService();
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      order: vi.fn(() => mockSupabase),
      insert: vi.fn(() => mockSupabase),
      update: vi.fn(() => mockSupabase),
      delete: vi.fn(() => mockSupabase),
      single: vi.fn(() => mockSupabase),
    };
    vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getMenuItems", () => {
    it("should return all menu items for a venue", async () => {
      const mockItems = [
        { id: "1", name: "Burger", price: 10, venue_id: "venue-1" },
        { id: "2", name: "Fries", price: 5, venue_id: "venue-1" },
      ];

      mockSupabase.single.mockResolvedValue({ data: mockItems, error: null });

      const items = await menuService.getMenuItems("venue-1");

      expect(items).toEqual(mockItems);
      expect(mockSupabase.from).toHaveBeenCalledWith("menu_items");
      expect(mockSupabase.eq).toHaveBeenCalledWith("venue_id", "venue-1");
    });

    it("should include unavailable items when requested", async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null });

      await menuService.getMenuItems("venue-1", { includeUnavailable: true });

      expect(mockSupabase.select).toHaveBeenCalled();
    });

    it("should filter by category when provided", async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null });

      await menuService.getMenuItems("venue-1", { categoryId: "cat-1" });

      expect(mockSupabase.eq).toHaveBeenCalledWith("category_id", "cat-1");
    });
  });

  describe("getMenuItem", () => {
    it("should return a single menu item by ID", async () => {
      const mockItem = { id: "1", name: "Burger", price: 10, venue_id: "venue-1" };
      mockSupabase.single.mockResolvedValue({ data: mockItem, error: null });

      const item = await menuService.getMenuItem("1", "venue-1");

      expect(item).toEqual(mockItem);
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "1");
    });

    it("should return null when item not found", async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      const item = await menuService.getMenuItem("nonexistent", "venue-1");

      expect(item).toBeNull();
    });
  });

  describe("createMenuItem", () => {
    it("should create a new menu item successfully", async () => {
      const itemData = {
        name: "New Burger",
        price: 15,
        category_id: "cat-1",
        description: "Delicious burger",
      };

      const mockCreatedItem = {
        id: "new-item-id",
        ...itemData,
        venue_id: "venue-1",
        is_available: true,
      };

      mockSupabase.select.mockResolvedValue({
        data: [mockCreatedItem],
        error: null,
      });

      const item = await menuService.createMenuItem("venue-1", itemData);

      expect(item).toEqual(mockCreatedItem);
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it("should throw error when creation fails", async () => {
      const error = { message: "Failed to create menu item" };
      mockSupabase.select.mockResolvedValue({ data: null, error });

      await expect(
        menuService.createMenuItem("venue-1", {
          name: "Burger",
          price: 10,
        })
      ).rejects.toThrow("Failed to create menu item");
    });
  });

  describe("updateMenuItem", () => {
    it("should update menu item successfully", async () => {
      const mockUpdatedItem = {
        id: "1",
        name: "Updated Burger",
        price: 12,
        venue_id: "venue-1",
      };

      mockSupabase.select.mockResolvedValue({
        data: [mockUpdatedItem],
        error: null,
      });

      const item = await menuService.updateMenuItem("1", "venue-1", {
        name: "Updated Burger",
        price: 12,
      });

      expect(item).toEqual(mockUpdatedItem);
      expect(mockSupabase.update).toHaveBeenCalled();
    });
  });

  describe("deleteMenuItem", () => {
    it("should delete menu item successfully", async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      await menuService.deleteMenuItem("1", "venue-1");

      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith("id", "1");
    });
  });

  describe("toggleAvailability", () => {
    it("should toggle item availability", async () => {
      const mockItem = { id: "1", is_available: false, venue_id: "venue-1" };
      mockSupabase.select.mockResolvedValue({
        data: [mockItem],
        error: null,
      });

      await menuService.toggleAvailability("1", "venue-1", true);

      expect(mockSupabase.update).toHaveBeenCalledWith({ is_available: true });
    });
  });

  describe("bulkUpdatePrices", () => {
    it("should update prices for multiple items", async () => {
      const priceUpdates = [
        { id: "1", price: 12 },
        { id: "2", price: 8 },
      ];

      mockSupabase.select.mockResolvedValue({
        data: priceUpdates,
        error: null,
      });

      await menuService.bulkUpdatePrices("venue-1", priceUpdates);

      expect(mockSupabase.update).toHaveBeenCalled();
    });
  });

  describe("getCategories", () => {
    it("should return all categories for a venue", async () => {
      const mockCategories = [
        { id: "1", name: "Burgers", venue_id: "venue-1" },
        { id: "2", name: "Drinks", venue_id: "venue-1" },
      ];

      mockSupabase.single.mockResolvedValue({ data: mockCategories, error: null });

      const categories = await menuService.getCategories("venue-1");

      expect(categories).toEqual(mockCategories);
      expect(mockSupabase.from).toHaveBeenCalledWith("menu_categories");
    });
  });

  describe("createCategory", () => {
    it("should create a new category successfully", async () => {
      const categoryData = { name: "New Category", display_order: 1 };

      const mockCreatedCategory = {
        id: "new-cat-id",
        ...categoryData,
        venue_id: "venue-1",
      };

      mockSupabase.select.mockResolvedValue({
        data: [mockCreatedCategory],
        error: null,
      });

      const category = await menuService.createCategory("venue-1", categoryData);

      expect(category).toEqual(mockCreatedCategory);
      expect(mockSupabase.insert).toHaveBeenCalled();
    });
  });
});
