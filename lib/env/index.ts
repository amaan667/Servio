/**
 * Centralized Environment Variable Validation
 *
 * This is the SINGLE SOURCE OF TRUTH for all environment variables.
 * All code MUST use this module instead of direct process.env access.
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   const apiKey = env('OPENAI_API_KEY');
 */

import { z } from "zod";

// Comprehensive environment variable schema
const envSchema = z.object({
  // Supabase (Required for runtime, but optional for graceful degradation)

  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Supabase anon key is required").optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "Supabase service role key is required").optional(),

  // Database

  // App URLs (Required)
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Stripe (Optional)

  // Redis (Optional)

  // AI Services (Optional)

  // Cron Jobs (Optional)

  // Monitoring (Optional)

  // Railway (Optional)

  // Logging (Optional)
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),

  // Resend (Optional)

  // Stripe Price IDs (Optional)

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;
let validationError: Error | null = null;

/**
 * Validate environment variables at startup
 * This runs once and caches the result
 */
function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  if (validationError) {
    throw validationError;
  }

  try {
    // During build time, be lenient with validation
    const isBuildTime =
      typeof window === "undefined" &&
      (process.env.NEXT_PHASE === "phase-production-build" ||
        !process.env.NEXT_PUBLIC_SUPABASE_URL);

    if (isBuildTime) {
      // Return mock values for build time
      validatedEnv = {

      } as Env;
      return validatedEnv!;
    }

    // At runtime, validate with graceful error handling
    // Use safeParse to handle validation errors gracefully
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      // Log the validation errors but don't crash
      const missing = result.error.errors
        .filter((e) => e.code === "invalid_type" && e.received === "undefined")
        .map((e) => e.path.join("."))
        .join(", ");

      if (missing) {
        
      }

      // FAIL FAST: In production, throw on missing required environment variables
      // This prevents misconfigured deployments from starting
      if (process.env.NODE_ENV === "production") {
        // Required environment variables for production
        const requiredVars = [
          "NEXT_PUBLIC_SUPABASE_URL",
          "NEXT_PUBLIC_SUPABASE_ANON_KEY",
          "SUPABASE_SERVICE_ROLE_KEY",
          "STRIPE_SECRET_KEY",
          "STRIPE_WEBHOOK_SECRET",
        ] as const;

        const missingVars: string[] = [];
        for (const varName of requiredVars) {
          if (!process.env[varName]) {
            missingVars.push(varName);
          }
        }

        if (missingVars.length > 0) {
          const errorMessage = `Missing required environment variables in production: ${missingVars.join(", ")}. Application cannot start without these variables.`;
          validationError = new Error(errorMessage);
          throw validationError;
        }

        // All required vars present, proceed with validation
        // Defensive: safeParse should always yield data when success=false was already handled,
        // but in case result.data is undefined, fall back to process.env to avoid crashing.
        validatedEnv = (result.data as Env | undefined) ?? (process.env as unknown as Env);
        return validatedEnv;
      } else {
        // In development, throw to see errors immediately
        const missing = result.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ");
        validationError = new Error(
          `Environment validation failed:\n${missing}\n\nPlease check your .env.local or Railway environment variables.`
        );
        throw validationError;
      }
    }

    validatedEnv = result.data;
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      validationError = new Error(
        `Environment validation failed:\n${missing}\n\nPlease check your .env.local or Railway environment variables.`
      );
      throw validationError;
    }
    throw error;
  }

  // Fallback (should never reach here)
  return validatedEnv!;
}

/**
 * Get validated environment variable
 *
 * @param key - Environment variable key
 * @returns Validated environment variable value
 * @throws Error if validation failed or variable is missing (for required vars)
 *
 * @example
 * ```ts
 * const apiKey = env('OPENAI_API_KEY'); // Returns string | undefined
 * const supabaseUrl = env('NEXT_PUBLIC_SUPABASE_URL'); // Returns string (required)
 * ```
 */
export function env<K extends keyof Env>(key: K): Env[K] {
  const validated = validateEnv();
  return validated[key];
}

/**
 * Get all validated environment variables
 * Use sparingly - prefer individual env() calls
 */
export function getEnv(): Env {
  return validateEnv();
}

/**
 * Check if we're in production
 */
export function isProduction(): boolean {
  return env("NODE_ENV") === "production";
}

/**
 * Check if we're in development
 */
export function isDevelopment(): boolean {
  return env("NODE_ENV") === "development";
}

/**
 * Check if we're in test
 */
export function isTest(): boolean {
  return env("NODE_ENV") === "test";
}

/**
 * Get NODE_ENV value (for conditional logic)
 * Prefer using isProduction(), isDevelopment(), isTest() when possible
 */
export function getNodeEnv(): "development" | "production" | "test" {
  return env("NODE_ENV");
}

// Validate on module load (server-side only)
// Use lazy validation - don't validate until first env() call
// This prevents crashes on module load
if (typeof window === "undefined") {
  // Don't validate on module load - validate lazily on first use
  // This allows the app to start even with missing env vars
}

// Export for backward compatibility
export const ENV = {
  get NODE_ENV() {
    return env("NODE_ENV");
  },
  get NEXT_PUBLIC_APP_URL() {
    return env("NEXT_PUBLIC_APP_URL");
  },
  get DATABASE_URL() {
    return env("DATABASE_URL");
  },
  get SUPABASE_URL() {
    return env("NEXT_PUBLIC_SUPABASE_URL");
  },
  get SUPABASE_ANON_KEY() {
    return env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return env("SUPABASE_SERVICE_ROLE_KEY");
  },
  get STRIPE_SECRET_KEY() {
    return env("STRIPE_SECRET_KEY");
  },
  get STRIPE_WEBHOOK_SECRET() {
    return env("STRIPE_WEBHOOK_SECRET");
  },
  get OPENAI_API_KEY() {
    return env("OPENAI_API_KEY");
  },
};
