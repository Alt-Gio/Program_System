// Fix Node.js v22 fetch IPv6 issue on Windows
import { setDefaultResultOrder } from "dns";
setDefaultResultOrder("ipv4first");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ["api.mapbox.com"],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "mapbox-gl": "mapbox-gl",
    };
    return config;
  },
};

export default nextConfig;
