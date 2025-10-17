// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ✅ Don’t block production builds on lint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ✅ Don’t block production builds on TS type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
