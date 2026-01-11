import {withSentryConfig} from '@sentry/nextjs';
import bundleAnalyzer from '@next/bundle-analyzer';
// Railway deployment trigger - ensures changes are detected
// Force deployment: 2025-11-26 14:10:00 UTC

const withBundleAnalyzer = bundleAnalyzer({

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Railway-specific configuration
  // Note: standalone mode temporarily disabled due to Next.js 15 build issue with 500.html
  // output: 'standalone',

    ignoreDuringBuilds: false, // ESLint runs during build
  },

  },
  // Performance optimizations

      'recharts', 
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-popover',
      'date-fns',
      'framer-motion',
    ],
    // Exclude server-only packages from bundling
    serverComponentsExternalPackages: ['playwright-core', 'playwright', '@sparticuz/chromium', 'puppeteer-core'],
  },

      exclude: ['error', 'info'], // Keep console.error for Sentry, console.info for Railway logs
    },
  },
  // Production optimizations

  compress: true, // Enable gzip compression
  generateEtags: true, // Enable ETags for caching
  // Performance headers
  async headers() {
    return [
      {

          },
          {

            value: 'public, max-age=31536000, immutable',
          },
          {

          },
        ],
      },
      {

            value: 'public, max-age=31536000, immutable',
          },
          {

          },
        ],
      },
      {

            value: 'public, max-age=31536000, immutable',
          },
          {

          },
        ],
      },
      {

          },
          {

          },
          {

          },
          {

          },
        ],
      },
      {

            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

    unoptimized: false, // Enable Next.js image optimization with sharp
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year

      },
      {

      },
    ],
  },
  // Bundle optimization
  webpack: (config, { dev, isServer, webpack }) => {
    // Performance budget - monitor bundle sizes
    // Realistic limits for production SaaS (vendor bundle is typically 2-4MB)
    if (!dev && !isServer) {
      config.performance = {
        maxAssetSize: 5000000, // 5MB per asset - realistic for vendor bundles
        maxEntrypointSize: 5000000, // 5MB per entrypoint - realistic for SPA pages
        hints: 'warning', // Warn but don't fail build
      };
    }

    // Only for client-side builds: ignore playwright-core
    if (!isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({

      );
      
      // Add fallback for modules not found in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,

        'playwright-core': false,
      };
    }
    
    if (!dev && !isServer) {
      config.optimization.splitChunks = {

          // Vendor chunk for node_modules

          },
          // Common chunk for shared components

          },
        },
      };
    }
    return config;
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  // Only print logs for uploading source maps in CI

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs

/* Deployment timestamp: 2025-12-05T23:14:48Z - Build ID: 1764976488 */