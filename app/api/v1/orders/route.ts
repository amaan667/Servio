/**
 * API v1 - Orders
 * Versioned orders endpoint with standardized responses
 * Currently proxies to legacy /api/orders endpoint
 */

// Re-export from original route for now
// This allows gradual migration to v1
export { GET, POST } from "../../orders/route";
