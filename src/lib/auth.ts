import "server-only";

import { PostgresDialect } from "kysely";
import { Pool } from "pg";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

const DEV_FALLBACK_SECRET = "edie-local-development-secret-not-for-production";

export function authDatabaseUrl() {
  const value = process.env.AUTH_DATABASE_URL?.trim();

  if (!value) {
    throw new Error(
      "AUTH_DATABASE_URL must point at the Postgres database holding auth tables.",
    );
  }

  return value;
}

function authSecret() {
  const value = process.env.BETTER_AUTH_SECRET?.trim();

  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "BETTER_AUTH_SECRET must be set to a random value of 32 characters or more.",
      );
    }

    return DEV_FALLBACK_SECRET;
  }

  return value;
}

export type AuthSession = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
  };
};

/** Kept lazy so importing this module never opens a database connection. */
let dialect: PostgresDialect | null = null;

function authDialect() {
  if (!dialect) {
    dialect = new PostgresDialect({
      pool: new Pool({ connectionString: authDatabaseUrl() }),
    });
  }

  return dialect;
}

type OAuthProviderConfig = { clientId: string; clientSecret: string };

function configuredSocialProviders() {
  const providers: Record<string, OAuthProviderConfig> = {};

  const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (googleId && googleSecret) {
    providers.google = { clientId: googleId, clientSecret: googleSecret };
  }

  const githubId = process.env.GITHUB_CLIENT_ID?.trim();
  const githubSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  if (githubId && githubSecret) {
    providers.github = { clientId: githubId, clientSecret: githubSecret };
  }

  return providers;
}

// Built lazily: creating the instance validates secrets and may connect to
// Postgres, neither of which should happen at import/build time.
let instance: ReturnType<typeof createAuthInstance> | null = null;

function createAuthInstance() {
  return betterAuth({
    secret: authSecret(),
    baseURL: process.env.BETTER_AUTH_URL?.trim() || undefined,
    database: {
      dialect: authDialect(),
      type: "postgres",
    },
    socialProviders: configuredSocialProviders(),
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google", "github"],
      },
    },
    plugins: [nextCookies()],
  });
}

export function getAuth() {
  if (!instance) {
    instance = createAuthInstance();
  }

  return instance;
}
