import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias['@'] = path.resolve(__dirname);
    
    // Suppress punycode deprecation warning
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'punycode': 'punycode',
      });
    }
    
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
