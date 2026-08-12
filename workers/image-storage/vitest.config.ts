import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({
    wrangler: { configPath: "./wrangler.jsonc" },
    miniflare: {
      // The installed local workerd lags the production compatibility date by one day.
      // Keep production on 2026-08-12 while exercising the same Worker code locally.
      compatibilityDate: "2026-08-11",
      bindings: {
        TICKET_SECRET: "test-ticket-secret-that-is-safely-longer-than-32",
        SERVICE_TOKEN: "test-service-token-that-is-safely-longer-than-32",
        ALLOWED_ORIGINS: "https://app.example.test,https://other.example.test"
      }
    }
  })]
});
