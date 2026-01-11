// Sentry global type declarations

declare global {
  interface Window {
    Sentry?: {
      captureException: (
        error: Error,
        options?: {
          contexts?: Record<string, unknown>;
          tags?: Record<string, string>;
          level?: "error" | "warning" | "info";
        }
      ) => void;
      captureMessage: (message: string, level?: "error" | "warning" | "info") => void;
      setUser: (user: { id?: string; email?: string; username?: string }) => void;
      setContext: (name: string, context: Record<string, unknown>) => void;
    };
  }
}

export /* Empty */ {};
