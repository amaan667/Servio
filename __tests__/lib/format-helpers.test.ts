import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatDuration,
  truncate,
  titleCase,
  formatOrderStatus,
  sanitizeForDisplay,
} from "@/lib/utils/format-helpers";

describe("Format Helpers", () => {
  describe("formatCurrency", () => {
    it("should format GBP correctly", () => {
      expect(formatCurrency(12.99)).toBe("£12.99");
      expect(formatCurrency(1000)).toBe("£1,000.00");
    });

    it("should handle zero", () => {
      expect(formatCurrency(0)).toBe("£0.00");
    });

    it("should format USD when specified", () => {
      const result = formatCurrency(12.99, "USD", "en-US");
      expect(result).toContain("12.99");
    });
  });

  describe("formatPercentage", () => {
    it("should format percentage with default decimals", () => {
      expect(formatPercentage(12.5)).toBe("12.5%");
    });

    it("should format percentage with custom decimals", () => {
      expect(formatPercentage(12.5678, 2)).toBe("12.57%");
    });
  });

  describe("formatNumber", () => {
    it("should abbreviate large numbers", () => {
      expect(formatNumber(1_500)).toBe("1.5K");
      expect(formatNumber(1_500_000)).toBe("1.5M");
      expect(formatNumber(1_500_000_000)).toBe("1.5B");
    });

    it("should keep small numbers as is", () => {
      expect(formatNumber(999)).toBe("999");
      expect(formatNumber(0)).toBe("0");
    });
  });

  describe("formatDuration", () => {
    it("should format milliseconds", () => {
      expect(formatDuration(500)).toBe("500ms");
    });

    it("should format seconds", () => {
      expect(formatDuration(2500)).toBe("2.5s");
    });

    it("should format minutes", () => {
      expect(formatDuration(90000)).toBe("1.5m");
    });

    it("should format hours", () => {
      expect(formatDuration(5400000)).toBe("1.5h");
    });
  });

  describe("truncate", () => {
    it("should truncate long strings", () => {
      expect(truncate("This is a very long string", 10)).toBe("This is...");
    });

    it("should not truncate short strings", () => {
      expect(truncate("Short", 10)).toBe("Short");
    });
  });

  describe("titleCase", () => {
    it("should capitalize each word", () => {
      expect(titleCase("hello world")).toBe("Hello World");
      expect(titleCase("MAIN COURSE")).toBe("Main Course");
    });
  });

  describe("formatOrderStatus", () => {
    it("should format known statuses", () => {
      const status = formatOrderStatus("PREPARING");
      expect(status.label).toBe("Preparing");
      expect(status.color).toContain("orange");
    });

    it("should handle unknown statuses", () => {
      const status = formatOrderStatus("CUSTOM_STATUS");
      expect(status.label).toBeTruthy();
      expect(status.color).toBeTruthy();
    });
  });

  describe("sanitizeForDisplay", () => {
    it("should escape HTML characters", () => {
      expect(sanitizeForDisplay("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
      );
    });

    it("should handle normal strings", () => {
      expect(sanitizeForDisplay("Hello World")).toBe("Hello World");
    });
  });
});
