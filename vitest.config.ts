import { defineConfig } from "vitest/config"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  // Compile JSX with the automatic runtime so test files and components
  // don't need `import React` (matches Next.js's own JSX setting).
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./components/test/setup.ts"],
    include: ["components/test/**/*.test.{ts,tsx}"],
  },

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
})