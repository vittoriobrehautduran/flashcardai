import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "pdf-parse",
    "pdfjs-dist",
    "canvas",
    "tesseract.js",
  ],
};

export default nextConfig;
