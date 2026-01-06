/**
 * Tests for entitlement guards - server-side enforcement
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all database interactions
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null })),
          maybeSingle: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
    })),
  })),
}));

describe("Entitlements Guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getVenueEntitlements", () => {
    it("should return entitlements for valid venue", async () => {
      const { createAdminClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.resolve({
          data: {
            tier: "pro",
            maxStaff: 15,
            maxTables: 100,
            maxLocations: 3,
            kds: { enabled: true, mode: "multi" },
            analytics: { level: "advanced", csvExport: true, financeExport: false },
            branding: { level: "full", customDomain: false },
            api: { enabled: false, level: null },
            support: { level: "priority" },
          },
          error: null,
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase);

      const { getVenueEntitlements } = await import("@/lib/entitlements/guards");

      const result = await getVenueEntitlements("venue-test");
      expect(result).toBeDefined();
      expect(result?.tier).toBe("pro");
      expect(result?.maxStaff).toBe(15);
    });

    it("should fail closed on invalid entitlement schema", async () => {
      const { createAdminClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.resolve({
          data: {
            tier: "invalid_tier", // Invalid enum value
            maxStaff: 5,
          },
          error: null,
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase);

      const { getVenueEntitlements } = await import("@/lib/entitlements/guards");

      const result = await getVenueEntitlements("venue-test");
      expect(result).toBeNull(); // FAIL CLOSED
    });

    it("should normalize null values to unlimited", async () => {
      const { createAdminClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.resolve({
          data: {
            tier: "enterprise",
            maxStaff: null, // Should become -1 (unlimited)
            maxTables: null,
            maxLocations: null,
            kds: { enabled: true, mode: "enterprise" },
            analytics: { level: "advanced", csvExport: true, financeExport: true },
            branding: { level: "white_label", customDomain: true },
            api: { enabled: true, level: "full" },
            support: { level: "sla" },
          },
          error: null,
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase);

      const { getVenueEntitlements } = await import("@/lib/entitlements/guards");

      const result = await getVenueEntitlements("venue-test");
      expect(result).not.toBeNull();
      expect(result!.maxStaff).toBe(-1); // Normalized
      expect(result!.maxTables).toBe(-1);
      expect(result!.maxLocations).toBe(-1);
    });
  });

  describe("requireEntitlement", () => {
    it("should allow access to enabled features", async () => {
      const { createAdminClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.resolve({
          data: {
            tier: "pro",
            maxStaff: 15,
            maxTables: 100,
            maxLocations: 3,
            kds: { enabled: true, mode: "multi" },
            analytics: { level: "advanced", csvExport: true, financeExport: false },
            branding: { level: "full", customDomain: false },
            api: { enabled: false, level: null },
            support: { level: "priority" },
          },
          error: null,
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase);

      const { requireEntitlement } = await import("@/lib/entitlements/guards");

      const result = await requireEntitlement("venue-test", "kds.enabled");
      expect(result.allowed).toBe(true);
      expect(result.requiredTier).toBeUndefined();
    });

    it("should deny access to disabled features", async () => {
      const { createAdminClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.resolve({
          data: {
            tier: "starter",
            maxStaff: 5,
            maxTables: 25,
            maxLocations: 1,
            kds: { enabled: false, mode: null },
            analytics: { level: "basic", csvExport: false, financeExport: false },
            branding: { level: "basic", customDomain: false },
            api: { enabled: false, level: null },
            support: { level: "email" },
          },
          error: null,
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase);

      const { requireEntitlement } = await import("@/lib/entitlements/guards");

      const result = await requireEntitlement("venue-test", "analytics.csvExport");
      expect(result.allowed).toBe(false);
      expect(result.requiredTier).toBe("pro");
    });
  });

  describe("requireMaxCount", () => {
    it("should allow operations within limits", async () => {
      const { createAdminClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.resolve({
          data: {
            tier: "starter",
            maxStaff: 5,
            maxTables: 25,
            maxLocations: 1,
            kds: { enabled: false, mode: null },
            analytics: { level: "basic", csvExport: false, financeExport: false },
            branding: { level: "basic", customDomain: false },
            api: { enabled: false, level: null },
            support: { level: "email" },
          },
          error: null,
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase);

      const { requireMaxCount } = await import("@/lib/entitlements/guards");

      const result = await requireMaxCount(
        { venueId: "venue-test", user: { id: "user-test" } },
        "staff",
        3, // 3 out of 5 allowed
        null
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5);
    });

    it("should deny operations over limits", async () => {
      const { createAdminClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.resolve({
          data: {
            tier: "starter",
            maxStaff: 5,
            maxTables: 25,
            maxLocations: 1,
            kds: { enabled: false, mode: null },
            analytics: { level: "basic", csvExport: false, financeExport: false },
            branding: { level: "basic", customDomain: false },
            api: { enabled: false, level: null },
            support: { level: "email" },
          },
          error: null,
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase);

      const { requireMaxCount } = await import("@/lib/entitlements/guards");

      const result = await requireMaxCount(
        { venueId: "venue-test", user: { id: "user-test" } },
        "staff",
        6, // 6 exceeds 5 limit
        null
      );

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(5);
      expect(result.message).toContain("Cannot create more than 5 staff members");
    });

    it("should enforce KDS station limits by mode", async () => {
      // Test starter with addon (1 station limit)
      const { createAdminClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.resolve({
          data: {
            tier: "starter",
            maxStaff: 5,
            maxTables: 25,
            maxLocations: 1,
            kds: { enabled: true, mode: "single" }, // Starter + addon
            analytics: { level: "basic", csvExport: false, financeExport: false },
            branding: { level: "basic", customDomain: false },
            api: { enabled: false, level: null },
            support: { level: "email" },
          },
          error: null,
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase);

      const { requireMaxCount } = await import("@/lib/entitlements/guards");

      const result = await requireMaxCount(
        { venueId: "venue-test", user: { id: "user-test" } },
        "kds_stations",
        2, // Trying to create 2nd station
        null
      );

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(1);
      expect(result.message).toContain("1 station");
    });
  });

  describe("requireTierAtLeast", () => {
    it("should allow access for sufficient tier", async () => {
      const { createAdminClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.resolve({
          data: {
            tier: "pro",
            maxStaff: 15,
            maxTables: 100,
            maxLocations: 3,
            kds: { enabled: true, mode: "multi" },
            analytics: { level: "advanced", csvExport: true, financeExport: false },
            branding: { level: "full", customDomain: false },
            api: { enabled: false, level: null },
            support: { level: "priority" },
          },
          error: null,
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase);

      const { requireTierAtLeast } = await import("@/lib/entitlements/guards");

      const result = await requireTierAtLeast("venue-test", "pro", "user-test");
      expect(result.allowed).toBe(true);
      expect(result.currentTier).toBe("pro");
    });

    it("should deny access for insufficient tier", async () => {
      const { createAdminClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.resolve({
          data: {
            tier: "starter",
            maxStaff: 5,
            maxTables: 25,
            maxLocations: 1,
            kds: { enabled: false, mode: null },
            analytics: { level: "basic", csvExport: false, financeExport: false },
            branding: { level: "basic", customDomain: false },
            api: { enabled: false, level: null },
            support: { level: "email" },
          },
          error: null,
        })),
      };
      vi.mocked(createAdminClient).mockReturnValue(mockSupabase);

      const { requireTierAtLeast } = await import("@/lib/entitlements/guards");

      const result = await requireTierAtLeast("venue-test", "pro", "user-test");
      expect(result.allowed).toBe(false);
      expect(result.currentTier).toBe("starter");
      expect(result.message).toContain("requires Pro plan or higher");
    });
  });
});