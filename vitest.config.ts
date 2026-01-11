import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({

      "**/dist/**",
      "**/.next/**",
      "**/e2e/**",
      "**/__tests__/e2e/**",
      "**/playwright-report/**",
    ],

      reporter: ["text", "json", "html", "lcov"],

        ".next/",
        "coverage/",
        "**/*.config.*",
        "**/*.d.ts",
        "__tests__/**",
        "docs/**",
        "public/**",
      ],

      },

        "app/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
        "utils/**/*.{ts,tsx}",
      ],
    },

  },

      "@": path.resolve(__dirname, "./"),
    },
  },
