/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [{ source: '/t/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] }];
  },
};

export default nextConfig;
