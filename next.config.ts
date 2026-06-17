import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // scene-engine é um pacote ESM linkado (file:) — Next precisa transpilá-lo.
  transpilePackages: ["@publisher/scene-engine"],
};

export default nextConfig;
