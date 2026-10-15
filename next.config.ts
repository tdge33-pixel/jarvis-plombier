import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Codespaces / tunnels : l'origine publique diffère de l'hôte local.
    serverActions: { allowedOrigins: ["localhost:3000", "*.app.github.dev"] },
  },
};

export default nextConfig;
