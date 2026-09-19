import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveAuthDatabaseUrl } from "./auth-database-url";

describe("resolveAuthDatabaseUrl", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers a dedicated auth database", () => {
    expect(
      resolveAuthDatabaseUrl({
        AUTH_DATABASE_URL: "  postgres://auth.example/auth  ",
        DATABASE_URL: "postgres://app.example/app",
      }),
    ).toBe("postgres://auth.example/auth");
  });

  it("falls back to the application database", () => {
    expect(
      resolveAuthDatabaseUrl({
        AUTH_DATABASE_URL: "   ",
        DATABASE_URL: "  postgres://preview.example/app  ",
      }),
    ).toBe("postgres://preview.example/app");
  });

  it("returns null when neither database is configured", () => {
    expect(resolveAuthDatabaseUrl({})).toBeNull();
  });
});
