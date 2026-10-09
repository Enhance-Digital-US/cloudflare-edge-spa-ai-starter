import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  const migrations = await readD1Migrations(resolve(__dirname, "migrations"));

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: resolve(__dirname, "../../wrangler.jsonc") },
        // Never reach real Cloudflare services from tests: no AI spend, and CI needs
        // no CLOUDFLARE_API_TOKEN (the `ai` binding would otherwise open a remote proxy).
        remoteBindings: false,
        miniflare: {
          bindings: {
            ENVIRONMENT: "development",
            BETTER_AUTH_SECRET: "test-secret-at-least-32-characters-long",
            BETTER_AUTH_URL: "http://localhost",
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./src/__tests__/setup/apply-migrations.ts"],
    },
  };
});
