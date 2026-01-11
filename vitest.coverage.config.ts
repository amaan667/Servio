import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({

      reporter: ["text", "json", "html", "lcov"],

        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
      ],

        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/*.stories.{ts,tsx}",
        "**/types/**",
        "**/*.d.ts",
        "**/globals.css",
        "app/**/loading.tsx",
        "app/**/layout.tsx",
        "app/**/error.tsx",
        "app/**/not-found.tsx",
      ],
      // Coverage thresholds - aim for 70%+

      },
    },
  },

      "@": path.resolve(__dirname, "."),
    },
  },
