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

  // Surface bugs early via double-invoked effects in dev. No runtime cost in prod.
  reactStrictMode: true,

  // Emit a self-contained production server (server.js + minimal node_modules)
  // under .next/standalone — used by the production Dockerfile. Has no effect
  // on `next dev` or on Netlify deploys (Netlify ignores it).
  output: "standalone",

  // Don't advertise Next in HTTP headers (tiny security + ops hygiene win).
  poweredByHeader: false,

  // Skip browser source maps in production builds — smaller artefact, faster deploys.
  // Re-enable on demand via NEXT_PRODUCTION_SOURCE_MAPS=1 if a customer-facing bug needs them.
  productionBrowserSourceMaps:
    process.env.NEXT_PRODUCTION_SOURCE_MAPS === "1",

  // Strip console.* in production except error/warn — small bundle win
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  // Tree-shake heavy packages so unused exports don't ship to the client.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "sonner",
      "framer-motion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-select",
      "@radix-ui/react-popover",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-progress",
      "@radix-ui/react-avatar",
      "@radix-ui/react-accordion",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-separator",
    ],
  },

  // Modernize from `images.domains` (deprecated) to `remotePatterns`
  // and add Convex self-hosted + Google profile photo origins.
  images: {
    // Modern formats first — Next will fall back to PNG/JPEG when unsupported.
    formats: ["image/avif", "image/webp"],
    // Cache optimised variants for 24h on the CDN/edge.
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      { protocol: "https", hostname: "api.mapbox.com" },
      { protocol: "http",  hostname: "127.0.0.1", port: "3210" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "mapbox-gl": "mapbox-gl",
    };
    return config;
  },
};

// Optional: visualize bundle when ANALYZE=true is passed
let exported = nextConfig;
if (process.env.ANALYZE === "true") {
  try {
    const { default: withBundleAnalyzer } = await import(
      "@next/bundle-analyzer"
    );
    exported = withBundleAnalyzer({ enabled: true })(nextConfig);
  } catch {
    console.warn(
      "[next.config] ANALYZE=true but @next/bundle-analyzer not installed",
    );
  }
}

export default exported;
