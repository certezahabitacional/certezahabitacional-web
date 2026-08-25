/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  allowedDevOrigins: ["192.168.1.4"],

  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;