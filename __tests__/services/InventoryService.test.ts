/**
 * @fileoverview Unit tests for InventoryService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { InventoryService } from "@/lib/services/InventoryService";
import { createSupabaseClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: vi.fn(),
}));

describe("InventoryService", () => {
  let inventoryService: InventoryService;
  let mockSupabase: {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    inventoryService = new InventoryService();
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      order: vi.fn(() => mockSupabase),
      lt: vi.fn(() => mockSupabase),
      insert: vi.fn(() => mockSupabase),
      update: vi.fn(() => mockSupabase),
      delete: vi.fn(() => mockSupabase),
      single: vi.fn(() => mockSupabase),
      maybeSingle: vi.fn(() => mockSupabase),
      rpc: vi.fn(() => mockSupabase),
    };
    vi.mocked(createSupabaseClient).mockResolvedValue(mockSupabase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getInventory", () => {
    it("should return all inventory items for a venue", async () => {
      const mockInventory = [
        { id: "1", name: "Flour", venue_id: "venue-1", on_hand: 10, min_stock: 5, unit: "kg" },
        { id: "2", name: "Sugar", venue_id: "venue-1", on_hand: 8, min_stock: 3, unit: "kg" },
      ];

      mockSupabase.single.mockResolvedValue({ data: mockInventory, error: null });

      const inventory = await inventoryService.getInventory("venue-1");

      expect(inventory).toEqual(mockInventory);
      expect(mockSupabase.from).toHaveBeenCalledWith("v_stock_levels");
      expect(mockSupabase.eq).toHaveBeenCalledWith("venue_id", "venue-1");
    });

    it("should throw error when query fails", async () => {
      const error = new Error("Database error");
      mockSupabase.single.mockResolvedValue({ data: null, error });

      await expect(inventoryService.getInventory("venue-1")).rejects.toThrow("Database error");
    });
  });

  describe("getLowStock", () => {
    it("should return items below minimum stock", async () => {
      const mockLowStockItems = [
        { id: "1", name: "Flour", on_hand: 2, min_stock: 5, venue_id: "venue-1" },
        { id: "2", name: "Sugar", on_hand: 1, min_stock: 3, venue_id: "venue-1" },
      ];

      mockSupabase.single.mockResolvedValue({ data: mockLowStockItems, error: null });

      const items = await inventoryService.getLowStock("venue-1");

      expect(items).toEqual(mockLowStockItems);
      expect(mockSupabase.from).toHaveBeenCalledWith("inventory_items");
      expect(mockSupabase.lt).toHaveBeenCalledWith("on_hand", "min_stock");
    });
  });

  describe("adjustStock", () => {
    it("should adjust stock level via RPC", async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      await inventoryService.adjustStock("venue-1", "ingredient-1", 5, "Restock", "user-1");

      expect(mockSupabase.rpc).toHaveBeenCalledWith("adjust_stock_v2", {
        p_venue_id: "venue-1",
        p_ingredient_id: "ingredient-1",
        p_amount: 5,
        p_reason: "Restock",
        p_user_id: "user-1",
      });
    });

    it("should throw error when RPC fails", async () => {
      const error = new Error("RPC failed");
      mockSupabase.rpc.mockResolvedValue({ data: null, error });

      await expect(
        inventoryService.adjustStock("venue-1", "ingredient-1", 5, "Restock", "user-1")
      ).rejects.toThrow("RPC failed");
    });
  });

  describe("createIngredient", () => {
    it("should create a new ingredient successfully", async () => {
      const ingredientData = {
        name: "New Ingredient",
        unit: "kg",
        cost_per_unit: 2.5,
        par_level: 10,
        reorder_level: 5,
        initial_stock: 20,
      };

      const mockCreatedIngredient = {
        id: "new-ingredient-id",
        ...ingredientData,
        venue_id: "venue-1",
      };

      mockSupabase.single.mockResolvedValue({ data: mockCreatedIngredient, error: null });
      mockSupabase.insert.mockReturnValue(mockSupabase);

      const ingredient = await inventoryService.createIngredient("venue-1", ingredientData);

      expect(ingredient).toEqual(mockCreatedIngredient);
      expect(mockSupabase.from).toHaveBeenCalledWith("ingredients");
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it("should throw error when creation fails", async () => {
      const error = new Error("Failed to create ingredient");
      mockSupabase.single.mockResolvedValue({ data: null, error });

      await expect(
        inventoryService.createIngredient("venue-1", {
          name: "Test",
          unit: "kg",
        })
      ).rejects.toThrow("Failed to create ingredient");
    });
  });
});
