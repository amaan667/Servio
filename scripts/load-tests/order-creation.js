/* eslint-env k6 */
/**
 * k6 Load Test: Order Creation Flow
 *
 * This script tests the order creation endpoint under load.
 *
 * Usage:
 *   k6 run scripts/load-tests/order-creation.js
 *
 * For cloud execution:
 *   k6 cloud scripts/load-tests/order-creation.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics
const orderCreationRate = new Rate("order_creation_success");
const orderCreationTrend = new Trend("order_creation_duration");

// Test configuration
export const options = {
  stages: [
    { duration: "1m", target: 10 }, // Ramp up to 10 users
    { duration: "2m", target: 50 }, // Ramp up to 50 users
    { duration: "5m", target: 50 }, // Stay at 50 users
    { duration: "1m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"], // 95% < 500ms, 99% < 1s
    http_req_failed: ["rate<0.01"], // Error rate < 1%
    order_creation_success: ["rate>0.95"], // 95% success rate
  },
};

// Base URL - update for your environment
const BASE_URL = __ENV.BASE_URL || "https://servio-production.up.railway.app";
const VENUE_ID = __ENV.VENUE_ID || "venue-test";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "test-token"; // Use test token in staging

// Test data
const menuItems = [
  { menuItemId: "item-1", quantity: 2, price: 12.99 },
  { menuItemId: "item-2", quantity: 1, price: 8.5 },
];

export default function () {
  // Create order
  const orderPayload = JSON.stringify({
    venueId: VENUE_ID,
    items: menuItems,
    customerName: `Load Test Customer ${__VU}-${__ITER}`,
    customerPhone: "+441234567890",
    customerEmail: `loadtest-${__VU}-${__ITER}@example.com`,
    paymentMethod: "PAY_LATER",
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      Cookie: `sb-access-token=${AUTH_TOKEN}`,
    },
    tags: { name: "CreateOrder" },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/api/orders`, orderPayload, params);
  const duration = Date.now() - startTime;

  const success = check(res, {
    "status is 200": (r) => r.status === 200,
    "response has order id": (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success && body.data?.id;
      } catch {
        return false;
      }
    },
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  orderCreationRate.add(success);
  orderCreationTrend.add(duration);

  // Simulate user think time
  sleep(1);
}
