/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@trades/ui', '@trades/shared'],
  images: {
    domains: ['localhost', 'storage.googleapis.com'],
  },
};

module.exports = nextConfig;
