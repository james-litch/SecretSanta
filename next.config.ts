import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_TEST_DIST_DIR ?? '.next',
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ['192.168.0.65'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
