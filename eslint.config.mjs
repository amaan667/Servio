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
      
      // TypeScript
      "@typescript-eslint/no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      
      // Hooks
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
      
      // Code quality
      "no-empty": ["error", { "allowEmptyCatch": true }],
      "no-useless-catch": "warn",
      "no-case-declarations": "error",
      "prefer-const": "warn",
      
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
