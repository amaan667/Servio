/**
 * Tests for dashboard logging API
 */

import { describe, it, expect } from "vitest";
import { createMockRequest } from "../helpers/api-test-helpers";
import { POST as postPOST } from "@/app/api/log-dashboard/route";

describe("Log Dashboard API", () => {
  describe("POST /api/log-dashboard", () => {
    it("accepts a valid log payload", async () => {
      const body = {
        level: "info",
        event: "test_event",
        venueId: "venue-test",
        details: {
          example: "value",
        },
      } as const;

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/log-dashboard",
        { body }
      );

      const response = await postPOST(request);
      expect(response.status).toBe(200);
    });

    it("rejects an invalid payload", async () => {
      const body = {
        // missing required "event" field
        level: "info",
      };

      const request = createMockRequest(
        "POST",
        "http://localhost:3000/api/log-dashboard",
        { body }
      );

      const response = await postPOST(request);
      expect(response.status).toBe(400);
    });
  });
});


