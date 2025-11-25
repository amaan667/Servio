/**
 * Input Sanitization Utilities
 * Provides sanitization for user input to prevent XSS and injection attacks
 */

import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [], // No HTML tags allowed by default
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize text input (removes HTML tags)
 */
export function sanitizeText(text: string): string {
  if (typeof text !== "string") {
    return String(text);
  }
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  return sanitizeText(email).toLowerCase();
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };
  for (const key in sanitized) {
    if (typeof sanitized[key] === "string") {
      sanitized[key] = sanitizeText(sanitized[key] as string) as T[Extract<keyof T, string>];
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key] as Record<string, unknown>) as T[Extract<keyof T, string>];
    }
  }
  return sanitized;
}

/**
 * Validate and sanitize input based on type
 */
export function sanitizeInput(input: unknown, type: "text" | "email" | "url" | "number"): string | number {
  if (type === "number") {
    const num = Number(input);
    return isNaN(num) ? 0 : num;
  }

  const str = String(input || "");
  switch (type) {
    case "email":
      return sanitizeEmail(str);
    case "url":
      return sanitizeUrl(str);
    case "text":
    default:
      return sanitizeText(str);
  }
}
