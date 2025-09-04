import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Remove legacy PDF/OCR externals
  serverExternalPackages: [],
  
  // Fix dynamic server usage errors for Next.js 15
  experimental: {
    // Disable static generation for routes that use cookies
    staticGenerationAsyncStorage: false,
  },
  
  // Force dynamic rendering for routes that use authentication
  generateStaticParams: async () => {
    return [];
  },
  
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['@'] = path.resolve(__dirname);
    
    // Fix punycode deprecation warning by using userland package
    config.resolve.alias['punycode'] = 'punycode';
    
    // Ignore punycode deprecation warnings
    config.ignoreWarnings = config.ignoreWarnings || [];
    config.ignoreWarnings.push({
      module: /node_modules\/punycode/,
      message: /The `punycode` module is deprecated/,
    });
    
    return config;
  },
};

export default nextConfig;
