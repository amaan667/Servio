import {withSentryConfig} from '@sentry/nextjs';
import bundleAnalyzer from '@next/bundle-analyzer';
// Railway deployment trigger - ensures changes are detected
// Force deployment: 2025-11-26 14:10:00 UTC

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Railway-specific configuration
  // Note: standalone mode temporarily disabled due to Next.js 15 build issue with 500.html
  // output: 'standalone',
  trailingSlash: false,
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false, // ESLint runs during build
  },
  typescript: {
    // TypeScript errors resolved - strict mode enabled
    ignoreBuildErrors: false,
  },
  // Performance optimizations
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
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
  compiler: {
    // Remove console logs in production (keep console.error and console.info for Railway logs)
    removeConsole: {
      exclude: ['error', 'info'], // Keep console.error for Sentry, console.info for Railway logs
    },
  },
  // Production optimizations
  poweredByHeader: false,
  compress: true, // Enable gzip compression
  generateEtags: true, // Enable ETags for caching
  // Performance headers
  async headers() {
    return [
      {
        source: '/_next/static/css/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/css',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      {
        source: '/_next/static/chunks/:path*',
        headers: [
          // Removed explicit Content-Type - Next.js handles MIME types correctly
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      {
        source: '/_next/static/media/:path*',
        headers: [
          // Removed explicit Content-Type - Next.js handles MIME types correctly
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=(self)'
          },
          {
            // Content Security Policy - balanced security with Next.js compatibility
            // Note: 'unsafe-inline' needed for Next.js inline scripts/styles
            // Note: 'unsafe-eval' needed for some Next.js features in dev
            // Allow loading images from any HTTPS origin so that menu item photos
            // scraped from restaurant websites can be displayed correctly.
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'production'
              ? [
                  "default-src 'self'",
                  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.sentry.io https://www.googletagmanager.com https://www.google-analytics.com",
                  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                  "img-src 'self' data: blob: https: https://*.supabase.co https://images.unsplash.com https://*.stripe.com https://www.googletagmanager.com https://www.google-analytics.com",
                  "font-src 'self' https://fonts.gstatic.com",
                  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.sentry.io https://*.ingest.sentry.io https://*.google-analytics.com https://region1.google-analytics.com https://region2.google-analytics.com https://www.googletagmanager.com https://analytics.google.com",
                  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
                  "frame-ancestors 'self'",
                  "form-action 'self'",
                  "base-uri 'self'",
                  "object-src 'none'",
                  "upgrade-insecure-requests",
                ].join('; ')
              : '' // Don't apply CSP in development (causes issues with hot reload)
          },
        ].filter(h => h.value !== ''), // Filter out empty headers in dev
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: false, // Enable Next.js image optimization with sharp
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/**',
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

    // Ignore optional packages (not installed) - avoids "Module not found" at build time
    if (isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /^dd-trace$/ }),
        new webpack.IgnorePlugin({ resourceRegExp: /^newrelic$/ }),
        new webpack.IgnorePlugin({ resourceRegExp: /^twilio$/ })
      );
    }

    // Only for client-side builds: ignore playwright-core
    if (!isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^playwright-core$/,
        })
      );

      // Add fallback for modules not found in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        electron: false,
        'playwright-core': false,
      };
    }
    
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk for node_modules
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Common chunk for shared components
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
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

  org: "servio-hx",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
});
/* Deployment timestamp: 2025-12-05T23:14:48Z - Build ID: 1764976488 */