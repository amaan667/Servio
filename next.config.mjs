/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force fresh build - cache bust for Railway
  generateBuildId: async () => {
    // Force new build ID to clear CSS/JS cache after fixing React hooks and config
    return `mime-fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },
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
    optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui/react-icons'],
    // Exclude server-only packages from bundling
    serverComponentsExternalPackages: ['playwright-core', 'playwright'],
  },
  compiler: {
    // Keep ALL console logs in production for debugging (including .log, .info)
    // Only remove console in production build if explicitly needed later
    removeConsole: false,
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
    // Performance budget - prevent bundle size regressions
    if (!dev && !isServer) {
      config.performance = {
        maxAssetSize: 500000, // 500kb per asset
        maxEntrypointSize: 500000, // 500kb per entrypoint
        hints: 'warning', // Show warnings, don't fail build
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

export default nextConfig;
/* MIME type fix - CSS/JS headers updated - ${new Date().toISOString()} */
