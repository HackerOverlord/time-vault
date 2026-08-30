import { defineConfig } from "vitest/config"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
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