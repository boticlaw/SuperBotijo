/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip static generation for pages with client-side interactivity
  experimental: {
    // Enable dynamic rendering for all routes
  },
};

export default nextConfig;
