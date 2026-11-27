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
  // Fichiers que le tracer NFT ne devine pas seul pour le détourage :
  // onnxruntime charge ses .so via dlopen (invisible pour l'analyse
  // statique) et zod@3 (dep d'imgly) n'est tracé que pour son entrée ESM.
  // Sans eux, le standalone lève « libonnxruntime.so.1.17.3: cannot open
  // shared object file » à l'upload d'une photo.
  outputFileTracingIncludes: {
    "/api/pieces/\\[id\\]/photo": [
      "./node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/**/*",
      "./node_modules/.pnpm/zod@3*/node_modules/zod/lib/**/*",
    ],
  },
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
