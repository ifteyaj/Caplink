import { defineConfig } from "vitest/config";

// Standalone config: node environment, no frontend plugins.
// Every test database is an isolated temp directory — tests never open caplink.db.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 15000,
  },
});
