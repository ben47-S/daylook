import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone : sortie Docker légère (server.js + node_modules tracés).
  output: "standalone",
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
