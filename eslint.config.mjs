import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
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
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      // React
      "react/react-in-jsx-scope": "off",
      "react/no-unescaped-entities": "off", // Too strict for production content
      "react/prop-types": "off", // Using TypeScript instead
      "react/no-unknown-property": "warn",
      
      // Console - allow in development, remove in production build
      "no-console": "off", // Disabled - using logger utility instead
      
      // TypeScript - Relaxed for production
      "@typescript-eslint/no-unused-vars": "off", // Too noisy, build passes
      "@typescript-eslint/no-explicit-any": "off", // Gradual typing - too strict
      "@typescript-eslint/no-require-imports": "off", // Sometimes needed
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      
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
];
