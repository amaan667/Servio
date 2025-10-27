/**
 * Device/Session identification for real-time subscriptions
 * Ensures each device/tab has a unique identifier to prevent channel conflicts
 */

const DEVICE_ID_KEY = "servio-device-id";

/**
 * Get or create a unique device ID for this browser tab/session
 * This ID persists across page reloads but is unique per device/browser
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    // Server-side: generate a temporary ID
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Check if we already have a device ID stored
  let deviceId = sessionStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    // Generate a new device ID combining timestamp and random string
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

/**
 * Generate a unique channel name for real-time subscriptions
 * Format: {prefix}-{venueId}-{deviceId}
 */
export function getRealtimeChannelName(prefix: string, venueId: string): string {
  const deviceId = getDeviceId();
  return `${prefix}-${venueId}-${deviceId}`;
}

/**
 * Clear device ID (useful for testing or logout scenarios)
 */
export function clearDeviceId(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(DEVICE_ID_KEY);
  }
}
