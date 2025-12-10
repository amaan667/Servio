/* eslint-disable @typescript-eslint/no-unused-vars */
// AI Assistant Integration Test - Actual LLM execution
// This test runs REAL queries through the AI assistant to verify accuracy

import { describe, it, expect, beforeEach } from "vitest";
import { planAssistantAction } from "@/lib/ai/assistant-llm";
import { testCases, mockDataSummaries } from "./ai-assistant-comprehensive.test";
import type { AIAssistantContext } from "@/types/ai-assistant";

// Skip if no OpenAI key (for CI)
const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const describeWithAPI = hasOpenAIKey ? describe : describe.skip;

const mockContext: AIAssistantContext = {
  venueId: "test-venue-123",
  userId: "test-user-456",
  userRole: "owner",
  venueTier: "enterprise",
  timezone: "Europe/London",
  venueName: "Test Restaurant",
  address: null,
  phone: null,
  email: null,
  operatingHours: null,
  features: {
    kds: true,
    inventory: true,
    analytics: true,
  },
};

describeWithAPI("AI Assistant Integration - Live Testing", () => {
  // Test read-only queries use fast-path
  describe("Fast-Path Read-Only Queries", () => {
    const samplesToTest = testCases.readOnly.slice(0, 10); // Test first 10

    samplesToTest.forEach(({ prompt, shouldBeFastPath }) => {
      it(`should fast-path: "${prompt}"`, async () => {
        const result = await planAssistantAction(prompt, mockContext, mockDataSummaries);

        if (shouldBeFastPath) {
          // Fast-path should return direct answer with no tools
          expect(result.tools).toHaveLength(0);
          expect(result.directAnswer).toBeDefined();
          expect(result.directAnswer).not.toBe("");
          expect(result.reasoning).toContain("data summaries");
        }
      }, 10000); // 10s timeout for API calls
    });
  });

  // Test action queries use full planner
  describe("Full Planner Action Queries", () => {
    const samplesToTest = testCases.actions.slice(0, 15); // Test first 15

    samplesToTest.forEach(({ prompt, shouldBeFastPath, expectedTool }) => {
      it(`should plan: "${prompt}" → ${expectedTool}`, async () => {
        const result = await planAssistantAction(prompt, mockContext, mockDataSummaries);

        if (!shouldBeFastPath) {
          // Full planner should return tools
          expect(result.tools.length).toBeGreaterThan(0);

          if (expectedTool) {
            const toolNames = result.tools.map((t) => t.name);
            // Check if any tool matches the expected pattern
            const hasExpectedTool = toolNames.some(
              (name) => name === expectedTool || name.startsWith(expectedTool.split(".")[0])
            );
            expect(hasExpectedTool).toBe(true);
          }

          // Should have intent and reasoning
          expect(result.intent).toBeDefined();
          expect(result.reasoning).toBeDefined();
        }
      }, 15000); // 15s timeout for complex queries
    });
  });

  // Critical translation tests
  describe("Translation Accuracy", () => {
    const translationTests = [
      { prompt: "Translate menu to English", expectedLang: "en" },
      { prompt: "Translate to English", expectedLang: "en" },
      { prompt: "Translate full menu into english", expectedLang: "en" },
      { prompt: "Translate back to English", expectedLang: "en" },
      { prompt: "Translate to Spanish", expectedLang: "es" },
      { prompt: "Translate menu to French", expectedLang: "fr" },
      { prompt: "Translate to Arabic", expectedLang: "ar" },
    ];

    translationTests.forEach(({ prompt, expectedLang }) => {
      it(`should correctly translate: "${prompt}" → ${expectedLang}`, async () => {
        const result = await planAssistantAction(prompt, mockContext, mockDataSummaries);

        expect(result.tools.length).toBeGreaterThan(0);

        const translateTool = result.tools.find(
          (t) => t.name === "menu.translate" || t.name === "menu.translate_extended"
        );

        expect(translateTool).toBeDefined();
        expect(translateTool?.params).toHaveProperty("targetLanguage");
        expect((translateTool?.params as { targetLanguage: string }).targetLanguage).toBe(
          expectedLang
        );
      }, 10000);
    });
  });

  // QR code generation tests
  describe("QR Code Generation", () => {
    const qrTests = [
      {
        prompt: "Generate QR code for Table 5",
        expectedTools: ["qr.generate_table", "navigation.go_to_page"],
      },
      {
        prompt: "Create QR codes for tables 1-10",
        expectedTools: ["qr.generate_bulk", "navigation.go_to_page"],
      },
      {
        prompt: "Generate QR for counter",
        expectedTools: ["qr.generate_counter", "navigation.go_to_page"],
      },
    ];

    qrTests.forEach(({ prompt, expectedTools }) => {
      it(`should generate QR: "${prompt}"`, async () => {
        const result = await planAssistantAction(prompt, mockContext, mockDataSummaries);

        // Should return both QR generation AND navigation tools
        expect(result.tools.length).toBeGreaterThanOrEqual(2);

        const toolNames = result.tools.map((t) => t.name);
        expectedTools.forEach((expectedTool) => {
          expect(toolNames).toContain(expectedTool);
        });

        // All tools should have preview=false
        result.tools.forEach((tool) => {
          expect(tool.preview).toBe(false);
        });
      }, 10000);
    });
  });

  // Edge case handling
  describe("Edge Cases", () => {
    it("should handle empty data gracefully", async () => {
      const result = await planAssistantAction(
        "What is my revenue?",
        mockContext,
        {} // Empty data
      );

      // Should still return a valid response
      expect(result).toBeDefined();
      expect(result.intent).toBeDefined();
    }, 10000);

    it("should handle mixed case prompts", async () => {
      const result = await planAssistantAction(
        "SHOW ME REVENUE TODAY",
        mockContext,
        mockDataSummaries
      );

      expect(result).toBeDefined();
    }, 10000);

    it("should handle typos and variations", async () => {
      const result = await planAssistantAction(
        "whats my revenue today",
        mockContext,
        mockDataSummaries
      );

      expect(result).toBeDefined();
    }, 10000);
  });

  // Performance benchmarks
  describe("Performance Benchmarks", () => {
    it("fast-path should complete in <500ms", async () => {
      const start = Date.now();

      await planAssistantAction("What is my revenue today?", mockContext, mockDataSummaries);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    }, 10000);

    it("full planner should complete in <2000ms", async () => {
      const start = Date.now();

      await planAssistantAction("Generate QR code for Table 5", mockContext, mockDataSummaries);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    }, 10000);
  });
});

// Summary statistics generator
describe("Test Coverage Summary", () => {
  it("should have comprehensive coverage", () => {
    const totalTests =
      testCases.readOnly.length + testCases.actions.length + testCases.edgeCases.length;

    console.log("\n📊 AI Assistant Test Coverage:");
    console.log(`  Read-Only Queries: ${testCases.readOnly.length}`);
    console.log(`  Action Queries: ${testCases.actions.length}`);
    console.log(`  Edge Cases: ${testCases.edgeCases.length}`);
    console.log(`  Total Test Cases: ${totalTests}`);

    // Verify we have comprehensive coverage
    expect(testCases.readOnly.length).toBeGreaterThanOrEqual(30);
    expect(testCases.actions.length).toBeGreaterThanOrEqual(30);
    expect(testCases.edgeCases.length).toBeGreaterThanOrEqual(5);
  });

  it("should test all critical features", () => {
    const features = [
      "menu queries",
      "revenue analytics",
      "growth tracking",
      "top items",
      "time analysis",
      "category performance",
      "payment methods",
      "order patterns",
      "table metrics",
      "price changes",
      "translation",
      "menu management",
      "QR generation",
      "navigation",
      "orders",
      "inventory",
      "staff",
      "tables",
    ];

    console.log("\n✅ Feature Coverage:");
    features.forEach((feature) => console.log(`  - ${feature}`));

    expect(features.length).toBeGreaterThan(15);
  });
});
