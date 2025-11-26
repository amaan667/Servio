import bundleAnalyzer from '@next/bundle-analyzer';

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
    // Remove console logs in production (keep console.error for Sentry)
    removeConsole: {
      exclude: ['error'], // Keep console.error for error tracking
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
            value: 'text/css; charset=utf-8',
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
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
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
        source: '/_next/static/media/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'font/woff2',
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
        ],
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

export default withBundleAnalyzer(nextConfig);
/* Deployment timestamp: 2025-11-26T10:15:00Z - Build ID: 1764152100 */
