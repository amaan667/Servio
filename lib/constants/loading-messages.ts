/**
 * Standardized Loading Messages
 *
 * Use these constants for consistent loading messages throughout the app
 * This improves UX consistency and makes translations easier
 */

export const LOADING_MESSAGES = {
  // Generic

  // Pages

  // Actions

  // Data

  // Payment

  // Forms

  // Feedback

} as const;

export type LoadingMessageKey = keyof typeof LOADING_MESSAGES;

/**
 * Get loading message by key
 */
export function getLoadingMessage(key: LoadingMessageKey): string {
  return LOADING_MESSAGES[key];
}
