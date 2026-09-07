import type { NextConfig } from "next";

const pdfjsWorkerFiles = [
  "./node_modules/pdfjs-dist/legacy/build/pdf.mjs",
  "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
];

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "canvas",
    "tesseract.js",
  ],
  // Amplify Lambda tracing misses pdf.worker.mjs (dynamic import inside pdfjs).
  outputFileTracingIncludes: {
    "/api/pdf/extract": pdfjsWorkerFiles,
    "/api/math/extract": pdfjsWorkerFiles,
  },
};

export default nextConfig;
