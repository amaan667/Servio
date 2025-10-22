/**
 * Global error suppression for expected Supabase auth errors
 * This prevents refresh token errors from cluttering production logs
 */

// Store original console.error
const originalConsoleError = console.error;

/**
 * Check if an error is a Supabase refresh token error that should be suppressed
 */
function isSupabaseRefreshTokenError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return (
    errorMessage.includes("refresh_token_not_found") ||
    errorMessage.includes("Invalid Refresh Token") ||
    (errorMessage.includes("refresh_token") && errorMessage.includes("AuthApiError"))
  );
}

/**
 * Initialize error suppression for production
 * Call this once at application startup
 */
export function initErrorSuppression() {
  // Only suppress in production
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  // Override console.error to filter out expected auth errors
  console.error = (...args: unknown[]) => {
    // Check if any of the arguments is a Supabase refresh token error
    const shouldSuppress = args.some((arg) => isSupabaseRefreshTokenError(arg));

    if (shouldSuppress) {
      // Silently ignore these expected errors
      return;
    }

    // Pass through all other errors
    originalConsoleError.apply(console, args);
  };

  // Handle unhandled promise rejections
  if (typeof process !== "undefined" && process.on) {
    process.on("unhandledRejection", (reason: unknown) => {
      if (isSupabaseRefreshTokenError(reason)) {
        // Silently ignore these expected errors
        return;
      }
      // Let other errors through
      originalConsoleError("Unhandled Promise Rejection:", reason);
    });
  }
}

/**
 * Restore original error handling (for testing or debugging)
 */
export function restoreErrorHandling() {
  console.error = originalConsoleError;
}
