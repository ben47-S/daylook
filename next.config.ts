import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone : sortie Docker légère (server.js + node_modules tracés).
  output: "standalone",
  // Headers de sécurité sur toutes les routes (mêmes règles que rapply).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  experimental: {
    agentFeedback: true,
  },
  // Retrait du fond (étape 6) : paquets à charger depuis node_modules
  // au runtime (onnxruntime embarque des binaires natifs, ne pas les
  // bundler avec Turbopack).
  serverExternalPackages: [
    "@imgly/background-removal-node",
    "onnxruntime-node",
  ],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
