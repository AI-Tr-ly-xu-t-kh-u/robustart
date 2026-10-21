import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";

// Dùng chung một tệp .env ở thư mục beancast/ (đã nằm trong .gitignore). Chỉ đọc ở server, không đưa ra trình duyệt.
loadEnvConfig(resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {
  /* config options here */
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
