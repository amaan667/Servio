// Permission System Tests
import { describe, it, expect } from "vitest";
import {
  can,
  getCapabilities,
  UserRole,
  Capability,
  PermissionError,
} from "@/lib/auth/permissions";

describe("Permission System", () => {
  describe("can() - Capability Checks", () => {
    it("owner can perform all actions", () => {
      expect(can("owner", "venue.read")).toBe(true);
      expect(can("owner", "venue.manage")).toBe(true);
      expect(can("owner", "menu.create")).toBe(true);
      expect(can("owner", "menu.update")).toBe(true);
      expect(can("owner", "menu.delete")).toBe(true);
      expect(can("owner", "order.complete")).toBe(true);
      expect(can("owner", "inventory.adjust")).toBe(true);
      expect(can("owner", "analytics.read")).toBe(true);
      expect(can("owner", "staff.manage")).toBe(true);
    });

    it("manager can perform most actions except venue management", () => {
      expect(can("manager", "venue.read")).toBe(true);
      expect(can("manager", "venue.manage")).toBe(false);
      expect(can("manager", "menu.create")).toBe(true);
      expect(can("manager", "menu.update")).toBe(true);
      expect(can("manager", "menu.delete")).toBe(true);
      expect(can("manager", "order.complete")).toBe(true);
      expect(can("manager", "inventory.adjust")).toBe(true);
      expect(can("manager", "analytics.read")).toBe(true);
      expect(can("manager", "staff.read")).toBe(true);
      expect(can("manager", "staff.manage")).toBe(false);
    });

    it("staff can perform limited actions", () => {
      expect(can("staff", "venue.read")).toBe(true);
      expect(can("staff", "venue.manage")).toBe(false);
      expect(can("staff", "menu.create")).toBe(true); // Can create orders
      expect(can("staff", "menu.update")).toBe(false);
      expect(can("staff", "menu.delete")).toBe(false);
      expect(can("staff", "order.read")).toBe(true);
      expect(can("staff", "order.complete")).toBe(true);
      expect(can("staff", "inventory.read")).toBe(true);
      expect(can("staff", "inventory.adjust")).toBe(false);
      expect(can("staff", "analytics.read")).toBe(true);
      expect(can("staff", "kds.read")).toBe(true);
      expect(can("staff", "kds.update")).toBe(true);
    });

    it("viewer has read-only access", () => {
      expect(can("viewer", "venue.read")).toBe(true);
      expect(can("viewer", "venue.manage")).toBe(false);
      expect(can("viewer", "menu.create")).toBe(false);
      expect(can("viewer", "menu.update")).toBe(false);
      expect(can("viewer", "menu.delete")).toBe(false);
      expect(can("viewer", "order.read")).toBe(true);
      expect(can("viewer", "order.complete")).toBe(false);
      expect(can("viewer", "inventory.read")).toBe(true);
      expect(can("viewer", "inventory.adjust")).toBe(false);
      expect(can("viewer", "analytics.read")).toBe(true);
    });

    it("returns false for invalid role", () => {
      expect(can("invalid_role" as UserRole, "venue.read")).toBe(false);
    });
  });

  describe("getCapabilities() - Role Capabilities", () => {
    it("returns correct capabilities for owner", () => {
      const caps = getCapabilities("owner");
      expect(caps).toContain("venue.manage");
      expect(caps).toContain("menu.delete");
      expect(caps).toContain("staff.manage");
      expect(caps.length).toBeGreaterThan(10);
    });

    it("returns correct capabilities for manager", () => {
      const caps = getCapabilities("manager");
      expect(caps).toContain("menu.update");
      expect(caps).toContain("order.complete");
      expect(caps).not.toContain("venue.manage");
      expect(caps).not.toContain("staff.manage");
    });

    it("returns correct capabilities for staff", () => {
      const caps = getCapabilities("staff");
      expect(caps).toContain("order.complete");
      expect(caps).toContain("kds.update");
      expect(caps).not.toContain("menu.update");
      expect(caps).not.toContain("inventory.adjust");
    });

    it("returns correct capabilities for viewer", () => {
      const caps = getCapabilities("viewer");
      expect(caps).toContain("venue.read");
      expect(caps).toContain("order.read");
      expect(caps).not.toContain("menu.update");
      expect(caps).not.toContain("order.complete");
    });

    it("returns empty array for invalid role", () => {
      const caps = getCapabilities("invalid_role" as UserRole);
      expect(caps).toEqual([]);
    });
  });

  describe("PermissionError", () => {
    it("creates error with correct properties", () => {
      const error = new PermissionError(
        "Access denied",
        403,
        "menu.update",
        "viewer"
      );

      expect(error.message).toBe("Access denied");
      expect(error.statusCode).toBe(403);
      expect(error.capability).toBe("menu.update");
      expect(error.role).toBe("viewer");
      expect(error.name).toBe("PermissionError");
    });

    it("creates error with default status code", () => {
      const error = new PermissionError("Access denied");
      expect(error.statusCode).toBe(403);
    });
  });

  describe("Capability Hierarchy", () => {
    it("owner > manager > staff > viewer hierarchy is respected", () => {
      const ownerCaps = getCapabilities("owner");
      const managerCaps = getCapabilities("manager");
      const staffCaps = getCapabilities("staff");
      const viewerCaps = getCapabilities("viewer");

      // Owner should have more capabilities than manager
      expect(ownerCaps.length).toBeGreaterThan(managerCaps.length);

      // Manager should have more capabilities than staff
      expect(managerCaps.length).toBeGreaterThan(staffCaps.length);

      // Staff should have more capabilities than viewer
      expect(staffCaps.length).toBeGreaterThan(viewerCaps.length);
    });

    it("all roles can read venue", () => {
      expect(can("owner", "venue.read")).toBe(true);
      expect(can("manager", "venue.read")).toBe(true);
      expect(can("staff", "venue.read")).toBe(true);
      expect(can("viewer", "venue.read")).toBe(true);
    });

    it("only owner can manage venue", () => {
      expect(can("owner", "venue.manage")).toBe(true);
      expect(can("manager", "venue.manage")).toBe(false);
      expect(can("staff", "venue.manage")).toBe(false);
      expect(can("viewer", "venue.manage")).toBe(false);
    });
  });

  describe("Menu Capabilities", () => {
    it("owner and manager can create menu items", () => {
      expect(can("owner", "menu.create")).toBe(true);
      expect(can("manager", "menu.create")).toBe(true);
      expect(can("staff", "menu.create")).toBe(true); // Staff can create orders
      expect(can("viewer", "menu.create")).toBe(false);
    });

    it("owner and manager can update menu items", () => {
      expect(can("owner", "menu.update")).toBe(true);
      expect(can("manager", "menu.update")).toBe(true);
      expect(can("staff", "menu.update")).toBe(false);
      expect(can("viewer", "menu.update")).toBe(false);
    });

    it("owner and manager can delete menu items", () => {
      expect(can("owner", "menu.delete")).toBe(true);
      expect(can("manager", "menu.delete")).toBe(true);
      expect(can("staff", "menu.delete")).toBe(false);
      expect(can("viewer", "menu.delete")).toBe(false);
    });
  });

  describe("Order Capabilities", () => {
    it("owner, manager, and staff can complete orders", () => {
      expect(can("owner", "order.complete")).toBe(true);
      expect(can("manager", "order.complete")).toBe(true);
      expect(can("staff", "order.complete")).toBe(true);
      expect(can("viewer", "order.complete")).toBe(false);
    });

    it("all roles can read orders", () => {
      expect(can("owner", "order.read")).toBe(true);
      expect(can("manager", "order.read")).toBe(true);
      expect(can("staff", "order.read")).toBe(true);
      expect(can("viewer", "order.read")).toBe(true);
    });
  });

  describe("Inventory Capabilities", () => {
    it("owner and manager can adjust inventory", () => {
      expect(can("owner", "inventory.adjust")).toBe(true);
      expect(can("manager", "inventory.adjust")).toBe(true);
      expect(can("staff", "inventory.adjust")).toBe(false);
      expect(can("viewer", "inventory.adjust")).toBe(false);
    });

    it("only owner can manage inventory", () => {
      expect(can("owner", "inventory.manage")).toBe(true);
      expect(can("manager", "inventory.manage")).toBe(false);
      expect(can("staff", "inventory.manage")).toBe(false);
      expect(can("viewer", "inventory.manage")).toBe(false);
    });

    it("all roles can read inventory", () => {
      expect(can("owner", "inventory.read")).toBe(true);
      expect(can("manager", "inventory.read")).toBe(true);
      expect(can("staff", "inventory.read")).toBe(true);
      expect(can("viewer", "inventory.read")).toBe(true);
    });
  });

  describe("Analytics Capabilities", () => {
    it("all roles can read analytics", () => {
      expect(can("owner", "analytics.read")).toBe(true);
      expect(can("manager", "analytics.read")).toBe(true);
      expect(can("staff", "analytics.read")).toBe(true);
      expect(can("viewer", "analytics.read")).toBe(true);
    });

    it("owner and manager can export analytics", () => {
      expect(can("owner", "analytics.export")).toBe(true);
      expect(can("manager", "analytics.export")).toBe(true);
      expect(can("staff", "analytics.export")).toBe(false);
      expect(can("viewer", "analytics.export")).toBe(false);
    });
  });

  describe("Staff Management", () => {
    it("only owner can manage staff", () => {
      expect(can("owner", "staff.manage")).toBe(true);
      expect(can("manager", "staff.manage")).toBe(false);
      expect(can("staff", "staff.manage")).toBe(false);
      expect(can("viewer", "staff.manage")).toBe(false);
    });

    it("owner and manager can read staff", () => {
      expect(can("owner", "staff.read")).toBe(true);
      expect(can("manager", "staff.read")).toBe(true);
      expect(can("staff", "staff.read")).toBe(false);
      expect(can("viewer", "staff.read")).toBe(false);
    });
  });

  describe("Discount Capabilities", () => {
    it("owner and manager can create discounts", () => {
      expect(can("owner", "discount.create")).toBe(true);
      expect(can("manager", "discount.create")).toBe(true);
      expect(can("staff", "discount.create")).toBe(false);
      expect(can("viewer", "discount.create")).toBe(false);
    });
  });

  describe("KDS Capabilities", () => {
    it("all roles can read KDS", () => {
      expect(can("owner", "kds.read")).toBe(true);
      expect(can("manager", "kds.read")).toBe(true);
      expect(can("staff", "kds.read")).toBe(true);
      expect(can("viewer", "kds.read")).toBe(true);
    });

    it("owner, manager, and staff can update KDS", () => {
      expect(can("owner", "kds.update")).toBe(true);
      expect(can("manager", "kds.update")).toBe(true);
      expect(can("staff", "kds.update")).toBe(true);
      expect(can("viewer", "kds.update")).toBe(false);
    });
  });
});

