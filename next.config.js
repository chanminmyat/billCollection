/** @type {import('next').NextConfig} */
const distDir = process.env.NEXT_DIST_DIR || '.next';

const nextConfig = {
  distDir,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config, { dev }) => {
    // Avoid corrupted filesystem cache issues in local dev (.next/cache/*.pack.gz ENOENT).
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

module.exports = nextConfig;
