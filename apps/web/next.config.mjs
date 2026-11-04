/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/v1/:path*", destination: process.env.ACR_API_INTERNAL_URL + "/v1/:path*" }];
  }
};
export default nextConfig;
