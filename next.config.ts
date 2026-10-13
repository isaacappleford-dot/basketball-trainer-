import type { NextConfig } from "next";

// Set by the GitHub Pages workflow: exports a static site served under /<repo-name>.
const pagesBasePath = process.env.PAGES_BASE_PATH;

const nextConfig: NextConfig = {
  ...(pagesBasePath !== undefined && {
    output: "export",
    basePath: pagesBasePath,
    trailingSlash: true,
    images: { unoptimized: true },
  }),
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
