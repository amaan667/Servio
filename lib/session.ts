
// Session management utilities for QR rescan and order resume functionality

export interface SessionData {
  sessionId: string;
  tableId?: string | null;
  tableNumber?: number;
  venueId: string;
  orderId?: string;
  paymentStatus?: "unpaid" | "paid" | "till";
  createdAt: string;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get or create a session ID from URL params or localStorage
 */
export function getOrCreateSessionId(tableNumber?: number, venueId?: string): string {
  // First, try to get from URL params
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get("session");

    if (sessionParam) {
      // Store in localStorage for future use
      localStorage.setItem("servio-current-session", sessionParam);
      return sessionParam;
    }

    // Try to get from localStorage
    const storedSession = localStorage.getItem("servio-current-session");
    if (storedSession) {
      return storedSession;
    }

    // Generate new session ID
    const newSessionId = generateSessionId();
    localStorage.setItem("servio-current-session", newSessionId);

    // Store session data
    const sessionData: SessionData = {
      sessionId: newSessionId,
      tableId: null,
      tableNumber: tableNumber || undefined,
      venueId: venueId || "",
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(`servio-session-${newSessionId}`, JSON.stringify(sessionData));

    return newSessionId;
  }

  return generateSessionId();
}

/**
 * Store session data
 */
export function storeSessionData(sessionData: SessionData): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(`servio-session-${sessionData.sessionId}`, JSON.stringify(sessionData));
    localStorage.setItem("servio-current-session", sessionData.sessionId);
  }
}

/**
 * Get session data by session ID
 */
export function getSessionData(sessionId: string): SessionData | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(`servio-session-${sessionId}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (_error) { /* Error handled silently */ }
    }
  }
  return null;
}

/**
 * Update session data with order information
 */
export function updateSessionWithOrder(
  sessionId: string,
  orderId: string,
  paymentStatus: "unpaid" | "paid" | "till"
): void {
  const sessionData = getSessionData(sessionId);
  if (sessionData) {
    sessionData.orderId = orderId;
    sessionData.paymentStatus = paymentStatus;
    storeSessionData(sessionData);
  }
}

/**
 * Clear session data
 */
export function clearSession(sessionId: string): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(`servio-session-${sessionId}`);
    localStorage.removeItem("servio-current-session");
  }
}

/**
 * Check if there's an open order for the current session
 */
export async function checkForOpenOrder(sessionId: string): Promise<unknown | null> {
  try {
    const response = await fetch(`/api/orders/session/${sessionId}/open`);
    const result = await response.json();

    if (result.success && result.data) {
      return result.data;
    }

    return null;
  } catch (_error) {

    return null;
  }
}

/**
 * Generate QR URL with session parameter
 */
export function generateQRUrl(venueId: string, tableNumber: number, sessionId?: string): string {
  const baseUrl = `${window.location.origin}/order?venue=${venueId}&table=${tableNumber}`;

  if (sessionId) {
    return `${baseUrl}&session=${sessionId}`;
  }

  return baseUrl;
}
