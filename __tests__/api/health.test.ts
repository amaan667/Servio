/**
 * @fileoverview Unit tests for health check API endpoint
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("should return 200 status with 'ok' text", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain");
  });

  it("should return 'ok' as response body", async () => {
    const response = await GET();
    const text = await response.text();

    expect(text).toBe("ok");
  });

  it("should include deploy time header", async () => {
    const response = await GET();
    const deployTime = response.headers.get("X-Deploy-Time");

    expect(deployTime).toBeTruthy();
    expect(deployTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
