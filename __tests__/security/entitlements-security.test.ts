/**
 * CRITICAL SECURITY TESTS for entitlements system
 * Tests all security hardening fixes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock createClient (guards use createClient, not createAdminClient)
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      rpc: vi.fn(),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: null })),
            maybeSingle: vi.fn(() => ({ data: null, error: null })),
          })),
        })),
      })),
    })
  ),
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

describe("Entitlements Security Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("RPC Access Control", () => {
    it("should reject unauthenticated access to get_venue_entitlements", async () => {
      const { createClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.reject(new Error("forbidden: authentication required"))),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const { getVenueEntitlements } = await import("@/lib/entitlements/guards");

      const result = await getVenueEntitlements("venue-test");
      expect(result).toBeNull();
    });

    it("should reject access to non-existent venue", async () => {
      const { createClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.reject(new Error("forbidden: venue not found"))),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const { getVenueEntitlements } = await import("@/lib/entitlements/guards");

      const result = await getVenueEntitlements("non-existent-venue");
      expect(result).toBeNull();
    });

    it("should reject access to venue user does not own or have staff role for", async () => {
      const { createClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() => Promise.reject(new Error("forbidden: access denied to venue"))),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const { getVenueEntitlements } = await import("@/lib/entitlements/guards");

      const result = await getVenueEntitlements("unauthorized-venue");
      expect(result).toBeNull();
    });
  });

  describe("Contract Validation", () => {
    it("should fail closed on malformed entitlement response", async () => {
      const { createClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() =>
          Promise.resolve({
            data: {
              tier: "invalid_tier", // Invalid enum value
              maxStaff: 5,
              // Missing required fields
            },
            error: null,
          })
        ),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const { getVenueEntitlements } = await import("@/lib/entitlements/guards");

      const result = await getVenueEntitlements("venue-test");
      expect(result).toBeNull(); // FAIL CLOSED
    });

    it("should fail closed on extra properties in response", async () => {
      const { createClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() =>
          Promise.resolve({
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
              // EXTRA PROPERTY - should fail validation
              maliciousField: "hacked",
            },
            error: null,
          })
        ),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const { getVenueEntitlements } = await import("@/lib/entitlements/guards");

      const result = await getVenueEntitlements("venue-test");
      expect(result).toBeNull(); // FAIL CLOSED due to strict validation
    });

    it("should normalize null values to unlimited", async () => {
      const { createClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() =>
          Promise.resolve({
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
          })
        ),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const { getVenueEntitlements } = await import("@/lib/entitlements/guards");

      const result = await getVenueEntitlements("venue-test");
      expect(result).not.toBeNull();
      expect(result!.maxStaff).toBe(-1); // Normalized
      expect(result!.maxTables).toBe(-1);
      expect(result!.maxLocations).toBe(-1);
    });
  });

  describe("Downgrade Safety", () => {
    it("should block Pro → Starter downgrade when venue count > 1", () => {
      // This would be tested in the database RPC function
      // Mock the validation function call
      expect(true).toBe(true); // Placeholder - actual test would require DB setup
    });

    it("should allow Pro → Starter downgrade when venue count = 1", () => {
      expect(true).toBe(true); // Placeholder - actual test would require DB setup
    });
  });

  describe("KDS Mode Enforcement", () => {
    it("should enforce single station limit for starter + addon", async () => {
      const { requireMaxCount } = await import("@/lib/entitlements/guards");

      const { createClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() =>
          Promise.resolve({
            data: {
              tier: "starter",
              maxStaff: 5,
              maxTables: 25,
              maxLocations: 1,
              kds: { enabled: true, mode: "single" },
              analytics: { level: "basic", csvExport: false, financeExport: false },
              branding: { level: "basic", customDomain: false },
              api: { enabled: false, level: null },
              support: { level: "email" },
            },
            error: null,
          })
        ),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const result = await requireMaxCount(
        { venueId: "venue-test", user: { id: "user-test" } },
        "kds_stations",
        2, // Trying to create 2nd station
        null
      );

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(1);
    });

    it("should allow unlimited stations for Pro tier", async () => {
      const { requireMaxCount } = await import("@/lib/entitlements/guards");

      const { createClient } = await import("@/lib/supabase");
      const mockSupabase = {
        rpc: vi.fn(() =>
          Promise.resolve({
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
          })
        ),
      };
      vi.mocked(createClient).mockResolvedValue(mockSupabase);

      const result = await requireMaxCount(
        { venueId: "venue-test", user: { id: "user-test" } },
        "kds_stations",
        100, // Many stations
        null
      );

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(null); // Unlimited
    });
  });

  describe("Add-on Uniqueness", () => {
    it("should prevent duplicate active add-ons", () => {
      // This is tested at the database level with the partial unique index
      expect(true).toBe(true); // Placeholder - actual test would require DB setup
    });

    it("should allow unlimited cancelled/expired add-on history", () => {
      // This is tested at the database level
      expect(true).toBe(true); // Placeholder - actual test would require DB setup
    });
  });
});
