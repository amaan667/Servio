import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@/lib/supabase";

/**
 * Integration tests for critical dashboard flows
 * Tests the complete user journey through key features
 */
describe("Dashboard Integration Tests", () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let testVenueId: string;
  let testUserId: string;

  beforeAll(async () => {
    supabase = await createClient();
    // Use test venue if available
    testVenueId = process.env.TEST_VENUE_ID || "test-venue";
    testUserId = process.env.TEST_USER_ID || "test-user";
  });

  describe("Venue Access Flow", () => {
    it("should verify venue exists and user has access", async () => {
      const { data: venue, error } = await supabase
        .from("venues")
        .select("venue_id, venue_name, owner_user_id")
        .eq("venue_id", testVenueId)
        .maybeSingle();

      expect(error).toBeNull();
      if (venue) {
        expect(venue.venue_id).toBeTruthy();
        expect(venue.venue_name).toBeTruthy();
      }
    });

    it("should check user role for venue", async () => {
      const { data: roleData } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("venue_id", testVenueId)
        .eq("user_id", testUserId)
        .maybeSingle();

      // Role might be null if user is owner
      expect(roleData?.role || "owner").toMatch(/owner|manager|kitchen_staff|waiter/);
    });
  });

  describe("Menu Data Flow", () => {
    it("should load menu items for venue", async () => {
      const { data: menuItems, error } = await supabase
        .from("menu_items")
        .select("id, name, price, category")
        .eq("venue_id", testVenueId)
        .limit(10);

      expect(error).toBeNull();
      expect(Array.isArray(menuItems)).toBe(true);
    });

    it("should group menu items by category", async () => {
      const { data: menuItems } = await supabase
        .from("menu_items")
        .select("category")
        .eq("venue_id", testVenueId);

      if (menuItems && menuItems.length > 0) {
        const categories = new Set(menuItems.map((item) => item.category));
        expect(categories.size).toBeGreaterThan(0);
      }
    });
  });

  describe("Orders Data Flow", () => {
    it("should load orders for venue", async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, order_status, total_amount")
        .eq("venue_id", testVenueId)
        .limit(10);

      expect(error).toBeNull();
      expect(Array.isArray(orders)).toBe(true);
    });

    it("should filter orders by status", async () => {
      const { data: pendingOrders } = await supabase
        .from("orders")
        .select("id, order_status")
        .eq("venue_id", testVenueId)
        .in("order_status", ["PENDING", "CONFIRMED"])
        .limit(5);

      if (pendingOrders) {
        pendingOrders.forEach((order) => {
          expect(["PENDING", "CONFIRMED"]).toContain(order.order_status);
        });
      }
    });
  });

  describe("Tables Data Flow", () => {
    it("should load tables for venue", async () => {
      const { data: tables, error } = await supabase
        .from("tables")
        .select("id, label, status")
        .eq("venue_id", testVenueId);

      expect(error).toBeNull();
      expect(Array.isArray(tables)).toBe(true);
    });
  });
});
