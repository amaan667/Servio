import { describe, it, expect } from "vitest";

import { buildRevenueByCategory } from "@/app/dashboard/[venueId]/hooks/useAnalyticsData";

// These unit tests exercise the pure revenue-by-category builder without
// touching Supabase or React. They assume the new schema where
// menu_items reference menu_categories via category_id.

describe("buildRevenueByCategory", () => {
  it("groups revenue by menu category using menu_items + menu_categories", () => {
    const orders = [
      {
        id: "order-1",
        payment_status: "PAID",
        items: [
          // Two breakfast items, one dessert
          { menu_item_id: "item-1", quantity: 2, price: 10 }, // £20 breakfast
          { menu_item_id: "item-2", quantity: 1, price: 5 }, // £5 pastry
          { menu_item_id: "item-3", quantity: 1, price: 8 }, // £8 dessert
        ],
      },
      {
        id: "order-2",
        payment_status: "UNPAID", // should be ignored completely
        items: [{ menu_item_id: "item-1", quantity: 10, price: 10 }],
      },
      {
        id: "order-3",
        payment_status: "TILL", // treated as paid
        items: [
          { menu_item_id: "item-1", quantity: 1, price: 10 }, // £10 breakfast
          { menu_item_id: "item-4", quantity: 1, price: 12 }, // £12 mains
        ],
      },
    ];

    const menuItems = [
      { id: "item-1", category_id: "cat-breakfast" },
      { id: "item-2", category_id: "cat-breakfast" },
      { id: "item-3", category_id: "cat-desserts" },
      { id: "item-4", category_id: "cat-mains" },
    ];

    const categories = [
      { id: "cat-breakfast", name: "Breakfast" },
      { id: "cat-desserts", name: "Desserts" },
      { id: "cat-mains", name: "Mains" },
    ];

    const result = buildRevenueByCategory({
      orders,
      menuItems,
      categories,
    });

    // Only paid orders (PAID + TILL) should be included
    // Breakfast: order-1 (£20 + £5) + order-3 (£10) = £35
    // Desserts: order-1 (£8) = £8
    // Mains: order-3 (£12) = £12

    const byName = Object.fromEntries(result.map((r) => [r.name, r.value]));

    expect(byName.Breakfast).toBe(35);
    expect(byName.Desserts).toBe(8);
    expect(byName.Mains).toBe(12);

    // Sorted descending by value so Breakfast should come first
    expect(result[0].name).toBe("Breakfast");
    expect(result[0].value).toBe(35);
  });

  it("ignores items without matching menu_item_id/category mapping", () => {
    const orders = [
      {
        id: "order-1",
        payment_status: "PAID",
        items: [
          { menu_item_id: "item-known", quantity: 1, price: 10 },
          { menu_item_id: "item-unknown", quantity: 1, price: 999 }, // no menu item mapping
        ],
      },
    ];

    const menuItems = [{ id: "item-known", category_id: "cat-known" }];
    const categories = [{ id: "cat-known", name: "Known" }];

    const result = buildRevenueByCategory({ orders, menuItems, categories });

    const byName = Object.fromEntries(result.map((r) => [r.name, r.value]));

    // Only the mapped item should contribute revenue
    expect(byName.Known).toBe(10);
    expect(result).toHaveLength(1);
  });

  it("returns an empty array when there are no paid orders", () => {
    const orders = [
      { id: "o1", payment_status: "UNPAID", items: [] },
      { id: "o2", payment_status: "REFUNDED", items: [] },
    ];

    const menuItems: Array<{ id: string; category_id: string | null }> = [];
    const categories: Array<{ id: string; name: string }> = [];

    const result = buildRevenueByCategory({ orders, menuItems, categories });

    expect(result).toEqual([]);
  });
});
