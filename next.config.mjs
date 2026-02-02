/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep defaults; we force node runtime on API routes that need mongoose.
  },
};

export default nextConfig;
