/**
 * Request utilities for timeout handling and cancellation
 */

import React from "react";

export interface RequestConfig {
  timeout?: number;
  signal?: AbortSignal;
  retries?: number;
  retryDelay?: number;
}

export class RequestTimeoutError extends Error {
  constructor(message: string = "Request timeout") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export class RequestCancelledError extends Error {
  constructor(message: string = "Request cancelled") {
    super(message);
    this.name = "RequestCancelledError";
  }
}

/**
 * Creates an AbortController with timeout
 */
export function createTimeoutController(timeoutMs: number = 10000): AbortController {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  // Clear timeout if request completes before timeout
  controller.signal.addEventListener("abort", () => {
    clearTimeout(timeoutId);
  });

  return controller;
}

/**
 * Wraps a fetch request with timeout and cancellation support
 */
export async function fetchWithTimeout(
  url: string | URL | Request,
  options: RequestInit & RequestConfig = {
    /* Empty */
  }
): Promise<Response> {
  const { timeout = 10000, signal, retries = 0, retryDelay = 1000, ...fetchOptions } = options;

  let attempt = 0;
  let lastError: Error;

  while (attempt <= retries) {
    try {
      // Create timeout controller
      const timeoutController = createTimeoutController(timeout);

      // Combine signals if both provided
      const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutController.signal])
        : timeoutController.signal;

      const response = await fetch(url, {
        ...fetchOptions,
        signal: combinedSignal,
      });

      return response;
    } catch (_error) {
      lastError = _error as Error;
      attempt++;

      // Don't retry on certain errors
      if (
        _error instanceof RequestCancelledError ||
        (_error as Error).name === "AbortError" ||
        (_error as Error).name === "RequestTimeoutError"
      ) {
        throw _error;
      }

      // Don't retry if this was the last attempt
      if (attempt > retries) {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
    }
  }

  throw lastError!;
}

/**
 * Creates a cancellable promise that can be aborted
 */
export function createCancellablePromise<T>(
  executor: (
    resolve: (value: T) => void,
    reject: (reason?: unknown) => void,
    signal: AbortSignal
  ) => void,
  timeoutMs?: number
): { promise: Promise<T>; abort: () => void } {
  const controller = new AbortController();

  const promise = new Promise<T>((resolve, reject) => {
    const timeoutId = timeoutMs
      ? setTimeout(() => {
          controller.abort();
          reject(new RequestTimeoutError(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs)
      : null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
    };

    controller.signal.addEventListener("abort", () => {
      cleanup();
      reject(new RequestCancelledError());
    });

    try {
      executor(
        (value) => {
          cleanup();
          resolve(value);
        },
        (reason) => {
          cleanup();
          reject(reason);
        },
        controller.signal
      );
    } catch (_error) {
      cleanup();
      reject(_error);
    }
  });

  return {
    promise,
    abort: () => controller.abort(),
  };
}

/**
 * Debounced function that cancels previous calls
 */
export function createCancellableDebounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;
  let abortController: AbortController | null = null;

  const debounced = ((...args: Parameters<T>) => {
    return new Promise<ReturnType<T>>((resolve, reject) => {
      // Cancel previous call
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (abortController) {
        abortController.abort();
      }

      // Create new abort controller for this call
      abortController = new AbortController();

      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          resolve(result as ReturnType<T>);
        } catch (_error) {
          if ((_error as Error).name !== "RequestCancelledError") {
            reject(_error);
          }
        }
      }, delay);
    });
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  };

  return debounced;
}

/**
 * React hook for managing request cancellation
 */
export function useRequestCancellation() {
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const createRequest = React.useCallback((timeoutMs?: number) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new controller
    abortControllerRef.current = new AbortController();

    // Set timeout if specified
    if (timeoutMs) {
      setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, timeoutMs);
    }

    return abortControllerRef.current.signal;
  }, []);

  const cancelRequest = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      // Cleanup on unmount
      cancelRequest();
    };
  }, [cancelRequest]);

  return { createRequest, cancelRequest };
}
