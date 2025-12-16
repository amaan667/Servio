/**
 * @fileoverview Tests for revenue-by-category aggregation used in Today at a Glance
 */

import { describe, it, expect } from "vitest";
import { buildRevenueByCategory } from "@/app/dashboard/[venueId]/hooks/useAnalyticsData";

describe("buildRevenueByCategory", () => {
  it("aggregates revenue by resolved menu category name (single category)", () => {
    const result = buildRevenueByCategory({
      orders: [
        {
          payment_status: "PAID",
          total_amount: 12,
          items: [
            { menu_item_id: "m1", price: 3, quantity: 2 },
            { menu_item_id: "m2", price: 6, quantity: 1 },
          ],
        },
      ],
      menuItems: [
        { id: "m1", category_id: "c1" },
        { id: "m2", category_id: "c1" },
      ],
      categories: [{ id: "c1", name: "Drinks" }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Drinks");
    expect(result[0].value).toBe(12);
    expect(typeof result[0].color).toBe("string");
    expect(result[0].color.length).toBeGreaterThan(0);
  });

  it("parses JSON-string order items and uses unit_price/quantity", () => {
    const result = buildRevenueByCategory({
      orders: [
        {
          payment_status: "paid",
          total_amount: 9,
          items: JSON.stringify([{ menu_item_id: "m1", unit_price: "4.50", quantity: "2" }]),
        },
      ],
      menuItems: [{ id: "m1", category_id: "c1" }],
      categories: [{ id: "c1", name: "Drinks" }],
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Drinks");
    expect(result[0].value).toBeCloseTo(9, 5);
  });

  it("excludes unpaid/refunded orders", () => {
    const result = buildRevenueByCategory({
      orders: [
        {
          payment_status: "UNPAID",
          total_amount: 10,
          items: [{ menu_item_id: "m1", price: 10, quantity: 1 }],
        },
        {
          payment_status: "refunded",
          total_amount: 10,
          items: [{ menu_item_id: "m1", price: 10, quantity: 1 }],
        },
      ],
      menuItems: [{ id: "m1", category_id: "c1" }],
      categories: [{ id: "c1", name: "Drinks" }],
    });

    expect(result).toEqual([]);
  });

  it("does not emit Other/Uncategorized when menu lookup is unavailable", () => {
    const result = buildRevenueByCategory({
      orders: [
        {
          payment_status: "TILL",
          total_amount: 10,
          items: [{ category: "Food", price: 10, quantity: 1 }],
        },
      ],
      menuItems: [],
      categories: [],
    });

    expect(result).toEqual([]);
  });

  it("does not emit Uncategorized when items are present but not usable/mappable", () => {
    const result = buildRevenueByCategory({
      orders: [
        {
          payment_status: "PAID",
          total_amount: 5,
          items: [{ menu_item_id: "m1", price: 0, quantity: 2 }],
        },
      ],
      menuItems: [{ id: "m1", category_id: "c1" }],
      categories: [{ id: "c1", name: "Drinks" }],
    });

    expect(result).toEqual([]);
  });

  it("skips items whose menu item has no category_id (never emits Other)", () => {
    const result = buildRevenueByCategory({
      orders: [
        {
          payment_status: "PAID",
          total_amount: 10,
          items: [{ menu_item_id: "m1", price: 10, quantity: 1 }],
        },
      ],
      menuItems: [{ id: "m1", category_id: null }],
      categories: [{ id: "c1", name: "Drinks" }],
    });

    expect(result).toEqual([]);
  });
});
