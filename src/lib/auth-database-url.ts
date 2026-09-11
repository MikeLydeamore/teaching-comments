import "server-only";

type AuthDatabaseEnvironment = Record<string, string | undefined>;

/**
 * Use a dedicated auth database when configured. Otherwise keep auth data on
 * the application database, including Neon branches created for previews.
 */
export function resolveAuthDatabaseUrl(
  env: AuthDatabaseEnvironment = process.env,
) {
  return env.AUTH_DATABASE_URL?.trim() || env.DATABASE_URL?.trim() || null;
}
