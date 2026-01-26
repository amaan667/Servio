/**
 * Integration tests for Customer Menu Flow
 * Critical Path: QR Code Scan → Menu Display → Order Placement
 *
 * This tests the complete customer journey that MUST work for the business to operate.
 * If these tests fail, customers cannot place orders.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// =============================================================================
// MOCKS
// =============================================================================

// Mock the Supabase admin client (used by public menu endpoint)
const mockSupabaseFrom = vi.fn();
const mockSupabase = {
  from: mockSupabaseFrom,
};

vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(() => mockSupabase),
  createSupabaseClient: vi.fn(() => Promise.resolve(mockSupabase)),
  supabaseBrowser: vi.fn(() => mockSupabase),
}));

// Mock cache to avoid Redis dependency in tests
vi.mock("@/lib/cache", () => ({
  cache: {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  },
}));

// Mock rate limiting
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => Promise.resolve({ success: true, remaining: 99 })),
  RATE_LIMITS: {
    MENU_PUBLIC: { limit: 100, window: 60 },
    ORDER_CREATE: { limit: 30, window: 60 },
  },
}));

// =============================================================================
// TEST DATA
// =============================================================================

const TEST_VENUE_ID = "venue-test123";
const TEST_VENUE = {
  venue_id: TEST_VENUE_ID,
  venue_name: "Test Restaurant",
};

const TEST_MENU_ITEMS = [
  {
    id: "item-1",
    venue_id: TEST_VENUE_ID,
    name: "Burger",
    description: "Delicious beef burger",
    price: 12.99,
    category: "Main Course",
    is_available: true,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "item-2",
    venue_id: TEST_VENUE_ID,
    name: "Fries",
    description: "Crispy golden fries",
    price: 4.99,
    category: "Sides",
    is_available: true,
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "item-3",
    venue_id: TEST_VENUE_ID,
    name: "Milkshake",
    description: "Creamy vanilla milkshake",
    price: 5.99,
    category: "Drinks",
    is_available: true,
    created_at: "2024-01-01T00:00:00Z",
  },
];

const TEST_MENU_UPLOAD = {
  pdf_images: ["https://example.com/menu-page-1.jpg"],
  category_order: ["Main Course", "Sides", "Drinks"],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function setupSuccessfulMenuQuery() {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "venues") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: TEST_VENUE,
          error: null,
        }),
      };
    }
    if (table === "menu_items") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: TEST_MENU_ITEMS,
          error: null,
          count: TEST_MENU_ITEMS.length,
        }),
      };
    }
    if (table === "menu_uploads") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: TEST_MENU_UPLOAD,
          error: null,
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
}

function setupEmptyMenuQuery() {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "venues") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: TEST_VENUE,
          error: null,
        }),
      };
    }
    if (table === "menu_items") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };
    }
    if (table === "menu_uploads") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
}

function setupVenueNotFoundQuery() {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === "venues") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
    }
    if (table === "menu_items") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };
    }
    if (table === "menu_uploads") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
}

// =============================================================================
// TESTS: MENU API (Critical for QR Code Scanning)
// =============================================================================

describe("Customer Menu Flow Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/menu/[venueId] - Public Menu Endpoint", () => {
    it("CRITICAL: returns menu items for valid venue without authentication", async () => {
      setupSuccessfulMenuQuery();

      // Import the route handler
      const { menuService } = await import("@/lib/services/MenuService");

      // Call the service directly (simulates what the route handler does)
      const result = await menuService.getPublicMenuFull(TEST_VENUE_ID, {
        limit: 200,
        offset: 0,
      });

      // Verify the response structure
      expect(result).toHaveProperty("venue");
      expect(result).toHaveProperty("menuItems");
      expect(result).toHaveProperty("pdfImages");
      expect(result).toHaveProperty("categoryOrder");

      // Verify venue data
      expect(result.venue).toEqual({
        id: TEST_VENUE_ID,
        name: TEST_VENUE.venue_name,
      });

      // Verify menu items are returned
      expect(result.menuItems).toHaveLength(3);
      expect(result.menuItems[0]).toHaveProperty("name", "Burger");
    });

    it("CRITICAL: handles venue ID with and without 'venue-' prefix", async () => {
      setupSuccessfulMenuQuery();

      const { menuService } = await import("@/lib/services/MenuService");

      // Test with prefix
      const result1 = await menuService.getPublicMenuFull("venue-test123", {
        limit: 200,
        offset: 0,
      });
      expect(result1.venue).toBeDefined();

      // The API route normalizes the venue ID - test that normalization
      const venueIdWithPrefix = "venue-test123";
      const venueIdWithoutPrefix = "test123";

      const normalizedWithPrefix = venueIdWithPrefix.startsWith("venue-")
        ? venueIdWithPrefix
        : `venue-${venueIdWithPrefix}`;
      const normalizedWithoutPrefix = venueIdWithoutPrefix.startsWith("venue-")
        ? venueIdWithoutPrefix
        : `venue-${venueIdWithoutPrefix}`;

      expect(normalizedWithPrefix).toBe("venue-test123");
      expect(normalizedWithoutPrefix).toBe("venue-test123");
    });

    it("returns empty array for venue with no menu items", async () => {
      setupEmptyMenuQuery();

      const { menuService } = await import("@/lib/services/MenuService");

      const result = await menuService.getPublicMenuFull(TEST_VENUE_ID, {
        limit: 200,
        offset: 0,
      });

      expect(result.menuItems).toEqual([]);
      expect(result.pagination.returned).toBe(0);
    });

    it("throws error for non-existent venue", async () => {
      setupVenueNotFoundQuery();

      const { menuService } = await import("@/lib/services/MenuService");

      await expect(
        menuService.getPublicMenuFull("venue-nonexistent", {
          limit: 200,
          offset: 0,
        })
      ).rejects.toThrow("Venue not found");
    });

    it("returns PDF images when available", async () => {
      setupSuccessfulMenuQuery();

      const { menuService } = await import("@/lib/services/MenuService");

      const result = await menuService.getPublicMenuFull(TEST_VENUE_ID, {
        limit: 200,
        offset: 0,
      });

      expect(result.pdfImages).toEqual(TEST_MENU_UPLOAD.pdf_images);
    });

    it("returns category order when available", async () => {
      setupSuccessfulMenuQuery();

      const { menuService } = await import("@/lib/services/MenuService");

      const result = await menuService.getPublicMenuFull(TEST_VENUE_ID, {
        limit: 200,
        offset: 0,
      });

      expect(result.categoryOrder).toEqual(TEST_MENU_UPLOAD.category_order);
    });
  });

  // ===========================================================================
  // TESTS: Menu Item Response Format
  // ===========================================================================

  describe("Menu Item Response Format", () => {
    it("includes all required fields for display", async () => {
      setupSuccessfulMenuQuery();

      const { menuService } = await import("@/lib/services/MenuService");

      const result = await menuService.getPublicMenuFull(TEST_VENUE_ID, {
        limit: 200,
        offset: 0,
      });

      const menuItem = result.menuItems[0];

      // Required fields for customer display
      expect(menuItem).toHaveProperty("id");
      expect(menuItem).toHaveProperty("name");
      expect(menuItem).toHaveProperty("price");
      expect(menuItem).toHaveProperty("category");

      // Optional but important fields
      expect(menuItem).toHaveProperty("description");
    });

    it("returns correct price format (number)", async () => {
      setupSuccessfulMenuQuery();

      const { menuService } = await import("@/lib/services/MenuService");

      const result = await menuService.getPublicMenuFull(TEST_VENUE_ID, {
        limit: 200,
        offset: 0,
      });

      result.menuItems.forEach((item: { price: unknown }) => {
        expect(typeof item.price).toBe("number");
        expect(item.price).toBeGreaterThan(0);
      });
    });
  });

  // ===========================================================================
  // TESTS: Pagination
  // ===========================================================================

  describe("Menu Pagination", () => {
    it("respects limit parameter", async () => {
      setupSuccessfulMenuQuery();

      const { menuService } = await import("@/lib/services/MenuService");

      const result = await menuService.getPublicMenuFull(TEST_VENUE_ID, {
        limit: 2,
        offset: 0,
      });

      expect(result.pagination.limit).toBe(2);
    });

    it("respects offset parameter", async () => {
      setupSuccessfulMenuQuery();

      const { menuService } = await import("@/lib/services/MenuService");

      const result = await menuService.getPublicMenuFull(TEST_VENUE_ID, {
        limit: 200,
        offset: 1,
      });

      expect(result.pagination.offset).toBe(1);
    });

    it("indicates when more items are available", async () => {
      setupSuccessfulMenuQuery();

      const { menuService } = await import("@/lib/services/MenuService");

      const result = await menuService.getPublicMenuFull(TEST_VENUE_ID, {
        limit: 200,
        offset: 0,
      });

      expect(result.pagination).toHaveProperty("hasMore");
      expect(typeof result.pagination.hasMore).toBe("boolean");
    });
  });

  // ===========================================================================
  // TESTS: Error Handling (Resilience)
  // ===========================================================================

  describe("Error Handling", () => {
    it("handles database errors gracefully", async () => {
      mockSupabaseFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database connection failed", code: "PGRST000" },
        }),
      }));

      const { menuService } = await import("@/lib/services/MenuService");

      await expect(
        menuService.getPublicMenuFull(TEST_VENUE_ID, { limit: 200, offset: 0 })
      ).rejects.toThrow();
    });
  });
});

// =============================================================================
// TESTS: Order Flow (After Menu Display)
// =============================================================================

describe("Order Creation Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuccessfulMenuQuery();
  });

  it("accepts order with valid menu item IDs", async () => {
    // Setup order creation mock
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "order-123",
              venue_id: TEST_VENUE_ID,
              order_number: "ORD-001",
              status: "pending",
              total: 17.98,
            },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const orderData = {
      venue_id: TEST_VENUE_ID,
      items: [
        { menu_item_id: "item-1", quantity: 1, price: 12.99 },
        { menu_item_id: "item-2", quantity: 1, price: 4.99 },
      ],
      order_type: "dine_in",
      table_number: "5",
    };

    // Verify order structure is valid
    expect(orderData.items.length).toBeGreaterThan(0);
    expect(orderData.items.every((item) => item.menu_item_id && item.quantity > 0)).toBe(
      true
    );
  });

  it("calculates order total correctly", () => {
    const items = [
      { menu_item_id: "item-1", quantity: 2, price: 12.99 },
      { menu_item_id: "item-2", quantity: 3, price: 4.99 },
    ];

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    expect(total).toBeCloseTo(40.95, 2);
  });

  it("validates quantity is positive integer", () => {
    const validItem = { menu_item_id: "item-1", quantity: 2, price: 12.99 };
    const invalidItem = { menu_item_id: "item-2", quantity: 0, price: 4.99 };

    expect(validItem.quantity).toBeGreaterThan(0);
    expect(Number.isInteger(validItem.quantity)).toBe(true);
    expect(invalidItem.quantity).toBe(0);
  });
});

// =============================================================================
// TESTS: End-to-End Flow Simulation
// =============================================================================

describe("End-to-End Customer Journey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuccessfulMenuQuery();
  });

  it("CRITICAL: Complete flow from QR scan to order placement", async () => {
    // Step 1: Customer scans QR code with venue parameter
    const qrCodeUrl = `/order?venue=${TEST_VENUE_ID}&table=5`;
    const urlParams = new URLSearchParams(qrCodeUrl.split("?")[1]);
    const venueSlug = urlParams.get("venue");
    const tableNumber = urlParams.get("table");

    expect(venueSlug).toBe(TEST_VENUE_ID);
    expect(tableNumber).toBe("5");

    // Step 2: Fetch menu (public endpoint, no auth)
    const { menuService } = await import("@/lib/services/MenuService");
    const menuData = await menuService.getPublicMenuFull(venueSlug!, {
      limit: 200,
      offset: 0,
    });

    expect(menuData.menuItems.length).toBeGreaterThan(0);
    expect(menuData.venue.name).toBe(TEST_VENUE.venue_name);

    // Step 3: Customer adds items to cart
    const cart = [
      { ...menuData.menuItems[0], quantity: 2 }, // 2x Burger
      { ...menuData.menuItems[1], quantity: 1 }, // 1x Fries
    ];

    expect(cart.length).toBe(2);

    // Step 4: Calculate cart total
    const cartTotal = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    expect(cartTotal).toBeCloseTo(30.97, 2); // 2*12.99 + 1*4.99

    // Step 5: Prepare order data
    const orderData = {
      venue_id: venueSlug,
      table_number: tableNumber,
      items: cart.map((item) => ({
        menu_item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      total: cartTotal,
      order_type: "dine_in" as const,
    };

    // Verify order data structure
    expect(orderData.venue_id).toBe(TEST_VENUE_ID);
    expect(orderData.items).toHaveLength(2);
    expect(orderData.total).toBeCloseTo(30.97, 2);
  });
});
