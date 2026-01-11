/* eslint-disable */
/**
 * k6 Load Test: Dashboard Load
 *
 * This script tests dashboard endpoints under load.
 * Note: k6 scripts use k6-specific globals (__VU, __ITER, etc.) which are not standard JavaScript.
 *
 * Usage:
 *   k6 run scripts/load-tests/dashboard-load.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

// Custom metrics
const dashboardLoadTrend = new Trend("dashboard_load_duration");

// Test configuration
export const options = {
  stages: [
    { duration: "1m", target: 20 }, // Ramp up to 20 users
    { duration: "5m", target: 20 }, // Stay at 20 users
    { duration: "1m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    http_req_failed: ["rate<0.01"],
  },
};

// Base URL - update for your environment
const BASE_URL = __ENV.BASE_URL || "https://servio-production.up.railway.app";
const VENUE_ID = __ENV.VENUE_ID || "venue-test";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "test-token";

// Dashboard endpoints to test
const endpoints = [
  { path: `/api/dashboard/counts?venueId=${VENUE_ID}`, name: "DashboardCounts" },
  { path: `/api/dashboard/stats?venueId=${VENUE_ID}`, name: "DashboardStats" },
  { path: `/api/analytics?venueId=${VENUE_ID}&period=today`, name: "AnalyticsToday" },
  { path: `/api/orders?venueId=${VENUE_ID}&status=PLACED`, name: "OrdersPlaced" },
];

export default function () {
  endpoints.forEach((endpoint) => {
    const params = {
      headers: {
        Cookie: `sb-access-token=${AUTH_TOKEN}`,
      },
      tags: { name: endpoint.name },
    };

    const startTime = Date.now();
    const res = http.get(`${BASE_URL}${endpoint.path}`, params);
    const duration = Date.now() - startTime;

    const success = check(res, {
      "status is 200": (r) => r.status === 200,
      "response has data": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success && body.data !== undefined;
        } catch {
          return false;
        }
      },
      "response time < 500ms": (r) => r.timings.duration < 500,
    });

    dashboardLoadTrend.add(success ? duration : 0);

    // Small delay between requests
    sleep(0.5);
  });

  // Simulate user think time
  sleep(2);
}
