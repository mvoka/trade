/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@trades/ui', '@trades/shared'],
  reactStrictMode: true,
  images: {
    domains: ['localhost', 'storage.googleapis.com', 'cdn.trades-dispatch.com'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
