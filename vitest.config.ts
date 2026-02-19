import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(__dirname);

export default defineConfig({
  test: {
    glob: [
      "tests/**/*.test.ts",
      "packages/mcp-server/tests/**/*.test.ts",
      "packages/mcp-client/tests/**/*.test.ts",
      "packages/agent/tests/**/*.test.ts",
      "packages/integrations/solana-agent-kit/tests/**/*.test.ts",
    ],
    environment: "node",
    include: [
      "tests/**/*.test.ts",
      "packages/mcp-server/tests/**/*.test.ts",
      "packages/mcp-client/tests/**/*.test.ts",
      "packages/agent/tests/**/*.test.ts",
      "packages/integrations/solana-agent-kit/tests/**/*.test.ts",
    ],
    setupFiles: [path.resolve(root, "tests/setup.ts")],
    server: {
      deps: {
        external: [
          "fastify",
          "next",
          "next/server",
          "@modelcontextprotocol/sdk",
          "zod",
        ],
      },
    },
  },
  resolve: {
    alias: {
      "@v402pay/core": path.join(root, "packages/core/src/index.ts"),
      "@v402pay/gateway/config": path.join(root, "packages/gateway/src/config.ts"),
      "@v402pay/gateway": path.join(root, "packages/gateway/src/index.ts"),
      "@v402pay/sdk": path.join(root, "packages/sdk/src/index.ts"),
      "@v402pay/mcp-server": path.join(root, "packages/mcp-server/src/index.ts"),
      "@v402pay/mcp-client": path.join(root, "packages/mcp-client/src/index.ts"),
      "@v402pay/agent": path.join(root, "packages/agent/src/index.ts"),
      "@v402pay/solana-agent-kit": path.join(root, "packages/integrations/solana-agent-kit/src/index.ts"),
    },
  },
});
