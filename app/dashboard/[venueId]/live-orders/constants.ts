export const LIVE_STATUSES = ["PLACED", "IN_PREP", "READY", "SERVING", "SERVED", "COMPLETED"];
export const TERMINAL_STATUSES = ["CANCELLED", "REFUNDED", "EXPIRED"];
export const LIVE_WINDOW_STATUSES = [
  "PLACED",
  "IN_PREP",
  "READY",
  "SERVING",
  "SERVED",
  "COMPLETED",
];
export const ACTIVE_TABLE_ORDER_STATUSES = ["PLACED", "IN_PREP", "READY", "SERVING", "SERVED"];
export const LIVE_TABLE_ORDER_STATUSES = [
  "PLACED",
  "IN_PREP",
  "READY",
  "SERVING",
  "SERVED",
  "COMPLETED",
];

export const LIVE_ORDER_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
export const PREP_LEAD_MS = 30 * 60 * 1000; // 30 minutes default

export const REFRESH_INTERVALS = [5, 10, 15, 30, 60]; // seconds
