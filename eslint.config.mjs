import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  // Ignore build artifacts and dependencies
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "build/**",
      "dist/**",
      ".turbo/**",
      "coverage/**",
      ".vercel/**",
      "public/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    rules: {
      ...react.configs.recommended.rules,
      // React
      "react/react-in-jsx-scope": "off",
      "react/no-unescaped-entities": "off", // Too strict for production content
      "react/prop-types": "off", // Using TypeScript instead
      "react/no-unknown-property": "error",

      // Logging
      "no-console": "error",

      // Type safety
      // Enforce zero-unused across the repo with auto-fix for imports.
      // (typescript-eslint can’t auto-remove unused imports; this can.)
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      // NOTE: We intentionally do not enforce unused *variables* here because the
      // codebase currently has a lot of intentionally-unused locals in tests and
      // handlers (used for debugging / future assertions). We do enforce unused
      // imports (above) since those are pure noise and safely auto-fixable.
      "unused-imports/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-unsafe-function-type": "error",

      // Hooks
      "react-hooks/exhaustive-deps": "off", // Too strict - causes false positives
      "react-hooks/rules-of-hooks": "error", // Keep this - critical rule

      // Code quality
      "no-empty": ["error", { "allowEmptyCatch": true }],
      "no-useless-catch": "off", // Sometimes needed for error transformation
      "no-case-declarations": "off", // Switch cases often need const declarations
      "prefer-const": "off", // Too strict - causes noise
      "no-useless-escape": "off", // Sometimes escapes are needed

      // Ban direct subpath imports & old factories
      "no-restricted-imports": ["error", {
        "patterns": [
          { "group": ["@/lib/supabase/*"], "message": "Import only from '@/lib/supabase'." },
          { "group": ["@/lib/supabase/browser", "@/lib/supabase/client", "@/lib/supabase/server", "@/lib/supabase/unified-client"], "message": "Deprecated. Use '@/lib/supabase'." }
        ]
      }],
    },
  },
  // Temporarily allow console warnings in client/UI code while server code is strict
  {
    files: [
      "app/**/*.{js,ts,jsx,tsx}",
      "components/**/*.{js,ts,jsx,tsx}",
      "hooks/**/*.{js,ts,jsx,tsx}",
    ],
    ignores: ["app/api/**/*"],
    rules: {
      // Don’t emit warnings in lint output; client console is stripped in prod builds.
      "no-console": "off",
    },
  },
  // Allow console usage in operational tooling and diagnostic endpoints
  {
    files: [
      "scripts/**/*.{js,ts}",
      "__tests__/**/*.{js,ts,tsx}",
      "app/api/log-*/**/*",
      "app/api/debug/**/*",
      "app/api/test-log/**/*",
      "app/api/log-dashboard/route.ts",
      "app/api/log-payment-flow/route.ts",
      "public/sw.js",
      "lib/error-suppression.ts",
      "lib/logger/production-logger.ts",
      "lib/monitoring/apm.ts", // APM packages require require() for initialization
      "lib/monitoring/structured-logger.ts", // Structured logging needs console
    ],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];
