/**
 * Standardized Loading Messages
 *
 * Use these constants for consistent loading messages throughout the app
 * This improves UX consistency and makes translations easier
 */

export const LOADING_MESSAGES = {
  // Generic
  DEFAULT: "Loading...",
  PROCESSING: "Processing...",

  // Pages
  DASHBOARD: "Loading dashboard...",
  MENU: "Loading menu...",
  ORDERS: "Loading orders...",
  TABLES: "Loading tables...",
  STAFF: "Loading staff...",
  SETTINGS: "Loading settings...",
  ANALYTICS: "Loading analytics...",
  PAYMENT: "Processing payment...",

  // Actions
  SAVING: "Saving...",
  UPLOADING: "Uploading...",
  DELETING: "Deleting...",
  UPDATING: "Updating...",
  SUBMITTING: "Submitting...",

  // Data
  LOADING_ORDERS: "Loading orders...",
  LOADING_MENU_ITEMS: "Loading menu items...",
  LOADING_TABLES: "Loading tables...",
  LOADING_STAFF: "Loading staff members...",
  LOADING_ANALYTICS: "Loading analytics data...",

  // Payment
  PROCESSING_PAYMENT: "Processing your payment...",
  COMPLETING_ORDER: "Completing your order...",

  // Forms
  LOADING_FORM: "Loading form...",
  SUBMITTING_FORM: "Submitting form...",

  // Feedback
  LOADING_FEEDBACK: "Loading feedback form...",
  SUBMITTING_FEEDBACK: "Submitting feedback...",
} as const;

export type LoadingMessageKey = keyof typeof LOADING_MESSAGES;

/**
 * Get loading message by key
 */
export function getLoadingMessage(key: LoadingMessageKey): string {
  return LOADING_MESSAGES[key];
}
