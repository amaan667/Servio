/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress the punycode deprecation warning
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Suppress punycode deprecation warning in Node.js
      config.ignoreWarnings = [
        {
          module: /node_modules\/punycode/,
        },
        {
          message: /DEP0040/,
        },
      ];
    }
    return config;
  },
  
  // Other Next.js configurations
  reactStrictMode: true,
  swcMinify: true,
  
  // Environment variables
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

module.exports = nextConfig;