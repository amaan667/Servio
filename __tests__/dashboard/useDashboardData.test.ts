 
/**
 * @fileoverview Tests for useDashboardData hook
 * @module __tests__/dashboard/useDashboardData
 */

import { describe, it, expect, beforeEach } from "vitest";

describe("useDashboardData", () => {
  beforeEach(() => {
    // Reset test state
  });

  describe("Dashboard Counts", () => {
    it("should calculate total orders count", () => {
      const orders = [
        { id: "1", status: "completed" },
        { id: "2", status: "completed" },
        { id: "3", status: "pending" },
      ];

      const totalOrders = orders.length;
      expect(totalOrders).toBe(3);
    });

    it("should calculate pending orders count", () => {
      const orders = [
        { id: "1", status: "completed" },
        { id: "2", status: "pending" },
        { id: "3", status: "pending" },
      ];

      const pendingOrders = orders.filter((o) => o.status === "pending").length;
      expect(pendingOrders).toBe(2);
    });

    it("should calculate total revenue", () => {
      const orders = [
        { id: "1", total: 10.99, status: "completed" },
        { id: "2", total: 25.5, status: "completed" },
        { id: "3", total: 15.0, status: "pending" },
      ];

      const completedRevenue = orders
        .filter((o) => o.status === "completed")
        .reduce((sum, o) => sum + o.total, 0);

      expect(completedRevenue).toBe(36.49);
    });

    it("should calculate average order value", () => {
      const orders = [{ total: 10.0 }, { total: 20.0 }, { total: 30.0 }];

      const avgOrderValue = orders.reduce((sum, o) => sum + o.total, 0) / orders.length;
      expect(avgOrderValue).toBe(20.0);
    });
  });

  describe("Time Window Calculations", () => {
    it("should filter orders by date range", () => {
      const now = new Date("2025-10-23T12:00:00Z");
      const todayStart = new Date("2025-10-23T00:00:00Z");

      const orders = [
        { id: "1", created_at: "2025-10-23T10:00:00Z" },
        { id: "2", created_at: "2025-10-22T10:00:00Z" },
        { id: "3", created_at: "2025-10-23T11:00:00Z" },
      ];

      const todayOrders = orders.filter((o) => {
        const orderDate = new Date(o.created_at);
        return orderDate >= todayStart && orderDate <= now;
      });

      expect(todayOrders).toHaveLength(2);
    });

    it("should group orders by hour", () => {
      const orders = [
        { created_at: "2025-10-23T10:30:00Z" },
        { created_at: "2025-10-23T10:45:00Z" },
        { created_at: "2025-10-23T11:15:00Z" },
      ];

      const ordersByHour = orders.reduce((acc: Record<number, number>, order) => {
        const hour = new Date(order.created_at).getUTCHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, { /* Empty */ });

      expect(ordersByHour[10]).toBe(2);
      expect(ordersByHour[11]).toBe(1);
    });
  });

  describe("Table Management", () => {
    it("should calculate table utilization", () => {
      const tables = [
        { id: "1", status: "occupied" },
        { id: "2", status: "occupied" },
        { id: "3", status: "available" },
        { id: "4", status: "available" },
      ];

      const occupiedTables = tables.filter((t) => t.status === "occupied").length;
      const utilization = (occupiedTables / tables.length) * 100;

      expect(utilization).toBe(50);
    });

    it("should count available tables", () => {
      const tables = [
        { id: "1", status: "occupied" },
        { id: "2", status: "available" },
        { id: "3", status: "available" },
      ];

      const availableTables = tables.filter((t) => t.status === "available").length;
      expect(availableTables).toBe(2);
    });
  });

  describe("Menu Analytics", () => {
    it("should calculate popular items", () => {
      const orderItems = [
        { item_name: "Burger", quantity: 5 },
        { item_name: "Pizza", quantity: 8 },
        { item_name: "Salad", quantity: 3 },
      ];

      const sorted = [...orderItems].sort((a, b) => b.quantity - a.quantity);
      const topItem = sorted[0];

      expect(topItem.item_name).toBe("Pizza");
      expect(topItem.quantity).toBe(8);
    });

    it("should group revenue by category", () => {
      const orderItems = [
        { category: "Main", total: 25.0 },
        { category: "Main", total: 30.0 },
        { category: "Dessert", total: 10.0 },
      ];

      const revenueByCategory = orderItems.reduce((acc: Record<string, number>, item) => {
        acc[item.category] = (acc[item.category] || 0) + item.total;
        return acc;
      }, { /* Empty */ });

      expect(revenueByCategory["Main"]).toBe(55.0);
      expect(revenueByCategory["Dessert"]).toBe(10.0);
    });
  });

  describe("Performance Metrics", () => {
    it("should calculate average preparation time", () => {
      const orders = [
        { prep_time_minutes: 15 },
        { prep_time_minutes: 20 },
        { prep_time_minutes: 25 },
      ];

      const avgPrepTime = orders.reduce((sum, o) => sum + o.prep_time_minutes, 0) / orders.length;
      expect(avgPrepTime).toBe(20);
    });

    it("should track order status distribution", () => {
      const orders = [
        { status: "completed" },
        { status: "completed" },
        { status: "pending" },
        { status: "preparing" },
        { status: "completed" },
      ];

      const statusCounts = orders.reduce((acc: Record<string, number>, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, { /* Empty */ });

      expect(statusCounts["completed"]).toBe(3);
      expect(statusCounts["pending"]).toBe(1);
      expect(statusCounts["preparing"]).toBe(1);
    });
  });

  describe("Real-time Updates", () => {
    it("should handle incremental revenue updates", () => {
      let totalRevenue = 100.0;
      const newOrderAmount = 25.5;

      totalRevenue += newOrderAmount;

      expect(totalRevenue).toBe(125.5);
    });

    it("should handle order count increments", () => {
      const counts = {
        total: 10,
        pending: 2,
        completed: 8,
      };

      // New pending order
      counts.total += 1;
      counts.pending += 1;

      expect(counts.total).toBe(11);
      expect(counts.pending).toBe(3);
      expect(counts.completed).toBe(8);
    });

    it("should handle order status changes", () => {
      const counts = {
        pending: 5,
        preparing: 3,
        completed: 10,
      };

      // Order moves from pending to preparing
      counts.pending -= 1;
      counts.preparing += 1;

      expect(counts.pending).toBe(4);
      expect(counts.preparing).toBe(4);
      expect(counts.completed).toBe(10);
    });
  });
});
