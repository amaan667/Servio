/**
 * Content Security Policy Middleware
 * Provides comprehensive CSP headers for XSS protection
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CSP Configuration
 * Configure allowed sources for each directive
 */
export const cspConfig = {
  // Default fallback for unspecified directives
  defaultSrc: ["'self'"] as string[],

  // Script sources
  scriptSrc: [
    "'self'",
    "'unsafe-inline'", // Required for Next.js inline scripts
    "'unsafe-eval'", // Required for some dynamic code evaluation
    "https://js.stripe.com",
    "https://*.sentry.io",
    "https://www.google-analytics.com",
    "https://apis.google.com",
  ] as string[],

  // Style sources
  styleSrc: [
    "'self'",
    "'unsafe-inline'", // Required for styled-components, emotion, and inline styles
    "https://fonts.googleapis.com",
    "https://cdn.jsdelivr.net",
  ] as string[],

  // Image sources
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co",
    "https://*.stripe.com",
    "https://www.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://fonts.gstatic.com",
  ] as string[],

  // Font sources
  fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"] as string[],

  // Object sources (should be empty for most apps)
  objectSrc: ["'none'"] as string[],

  // Media sources
  mediaSrc: ["'self'", "blob:", "https://*.supabase.co"] as string[],

  // Frame sources (for embeds)
  frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"] as string[],

  // Connect sources (for API calls)
  connectSrc: [
    "'self'",
    "https://*.supabase.co",
    "https://*.stripe.com",
    "https://api.stripe.com",
    "https://api.openai.com",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://*.sentry.io",
    "wss://*.supabase.co",
  ] as string[],

  // Form action destinations
  formAction: ["'self'", "https://api.stripe.com"] as string[],

  // Base URI for relative URLs
  baseUri: ["'self'"] as string[],

  // Sandbox permissions (if needed)
  sandbox: [] as string[],

  // Require SRI for scripts and styles
  requireSriForScript: false,
  requireSriForStyle: false,

  // Report URI for CSP violations (optional - set to your reporting endpoint)
  reportUri: undefined as string | undefined,
};

/**
 * Build CSP header value from configuration
 */
function buildCSP(): string {
  const directives: string[] = [];

  directives.push(`default-src ${cspConfig.defaultSrc.join(" ")}`);
  directives.push(`script-src ${cspConfig.scriptSrc.join(" ")}`);
  directives.push(`style-src ${cspConfig.styleSrc.join(" ")}`);
  directives.push(`img-src ${cspConfig.imgSrc.join(" ")}`);
  directives.push(`font-src ${cspConfig.fontSrc.join(" ")}`);
  directives.push(`object-src ${cspConfig.objectSrc.join(" ")}`);
  directives.push(`media-src ${cspConfig.mediaSrc.join(" ")}`);
  directives.push(`frame-src ${cspConfig.frameSrc.join(" ")}`);
  directives.push(`connect-src ${cspConfig.connectSrc.join(" ")}`);
  directives.push(`form-action ${cspConfig.formAction.join(" ")}`);
  directives.push(`base-uri ${cspConfig.baseUri.join(" ")}`);

  if (cspConfig.sandbox.length > 0) {
    directives.push(`sandbox ${cspConfig.sandbox.join(" ")}`);
  }

  if (cspConfig.requireSriForScript) {
    directives.push("require-sri-for script");
  }

  if (cspConfig.requireSriForStyle) {
    directives.push("require-sri-for style");
  }

  if (cspConfig.reportUri) {
    directives.push(`report-uri ${cspConfig.reportUri}`);
  }

  return directives.join("; ");
}

/**
 * Additional security headers
 */
export const securityHeaders = {
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",

  // Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Control browser rendering capabilities
  "X-Frame-Options": "SAMEORIGIN",

  // Enable XSS protection (legacy but still useful)
  "X-XSS-Protection": "1; mode=block",

  // Control DNS prefetching
  "X-DNS-Prefetch-Control": "on",

  // Feature policy (deprecated but still useful for older browsers)
  "Permissions-Policy": [
    "accelerometer=()",
    "camera=()",
    "geolocation=()",
    "gyroscope=()",
    "magnetometer=()",
    "microphone=()",
    "payment=()",
    "usb=()",
  ].join(", "),

  // Strict Transport Security (HSTS) - enable in production
  // Note: This should be set with a relatively short max-age initially
  // and increased after confirming everything works
  "Strict-Transport-Security":
    process.env.NODE_ENV === "production"
      ? "max-age=31536000; includeSubDomains; preload"
      : "max-age=0",

  // Content Security Policy
  "Content-Security-Policy": buildCSP(),
};

/**
 * Headers to remove for security
 */
export const headersToRemove = [
  "X-Powered-By",
  "X-AspNet-Version",
  "X-AspNetMvc-Version",
  "Server",
];

/**
 * CSP Middleware for Next.js
 *
 * Add this to your middleware.ts file or use directly
 */
export function addSecurityHeaders(_request: NextRequest): NextResponse {
  const response = NextResponse.next();

  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    }
  });

  // Remove information-leaking headers
  headersToRemove.forEach((header) => {
    response.headers.delete(header);
  });

  return response;
}

/**
 * Get CSP configuration for the current environment
 */
export function getCSPConfigForEnvironment(): typeof cspConfig {
  // In development, allow more sources for easier debugging
  if (process.env.NODE_ENV === "development") {
    return {
      ...cspConfig,
      scriptSrc: [...cspConfig.scriptSrc, "'unsafe-eval'"],
      connectSrc: [...cspConfig.connectSrc, "http://localhost:*"],
      styleSrc: [...cspConfig.styleSrc, "'unsafe-inline'"],
    };
  }

  // In production, be more restrictive
  return cspConfig;
}

/**
 * Generate CSP report for monitoring
 */
export interface CSPReport {
  "document-uri": string;
  "violated-directive": string;
  "blocked-uri": string;
  "source-file"?: string;
  "line-number"?: number;
  "column-number"?: number;
  disposition: string;
}

/**
 * Validate CSP configuration
 */
export function validateCSPConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for dangerous configurations
  if (cspConfig.scriptSrc.includes("'unsafe-inline'") && !cspConfig.scriptSrc.includes("'nonce-")) {
    errors.push(
      "Warning: 'unsafe-inline' in script-src allows inline scripts. Consider using nonces or hashes."
    );
  }

  if (cspConfig.scriptSrc.includes("'unsafe-eval'")) {
    errors.push("Warning: 'unsafe-eval' in script-src allows eval(). This is a security risk.");
  }

  if (cspConfig.objectSrc.includes("*")) {
    errors.push("Error: object-src should not be '*' as it allows plugins.");
  }

  if (cspConfig.defaultSrc.includes("'unsafe-inline'")) {
    errors.push("Warning: 'unsafe-inline' in default-src weakens CSP protection.");
  }

  // Check for wildcard overuse
  const wildcardPattern = /\*/g;
  const wildcardCount = JSON.stringify(cspConfig).match(wildcardPattern)?.length || 0;

  if (wildcardCount > 3) {
    errors.push(
      `Warning: CSP contains ${wildcardCount} wildcards. Consider using specific sources.`
    );
  }

  return {
    valid: errors.filter((e) => e.startsWith("Error")).length === 0,
    errors,
  };
}

export default addSecurityHeaders;
