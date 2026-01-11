import { defineConfig, devices } from "@playwright/test";

export default defineConfig({

    ["json", { outputFile: "test-results/results.json" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],

  },

      use: { ...devices["Desktop Chrome"] },
    },
    {

      use: { ...devices["Desktop Firefox"] },
    },
    {

      use: { ...devices["Desktop Safari"] },
    },
    // Mobile testing
    {

      use: { ...devices["Pixel 5"] },
    },
    {

      use: { ...devices["iPhone 12"] },
    },
  ],

  },

  // Global timeout

  },
