/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cssChunking: true,
  },
  webpack: (config) => {
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
