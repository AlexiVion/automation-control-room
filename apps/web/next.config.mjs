/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false, // Local portfolio screenshots should not show Next.js developer overlay.
  async rewrites() {
    return [{ source: "/v1/:path*", destination: process.env.ACR_API_INTERNAL_URL + "/v1/:path*" }];
  }
};
export default nextConfig;
