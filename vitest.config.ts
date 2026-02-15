import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(__dirname);

export default defineConfig({
  test: {
    glob: ["tests/**/*.test.ts"],
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: [path.resolve(root, "tests/setup.ts")],
    server: {
      deps: {
        external: ["fastify", "next", "next/server"],
      },
    },
  },
  resolve: {
    alias: {
      "@v402pay/core": path.join(root, "packages/core/src/index.ts"),
      "@v402pay/gateway/config": path.join(root, "packages/gateway/src/config.ts"),
      "@v402pay/gateway": path.join(root, "packages/gateway/src/index.ts"),
      "@v402pay/sdk": path.join(root, "packages/sdk/src/index.ts"),
    },
  },
});
