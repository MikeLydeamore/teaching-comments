export type StorageBackend = "local" | "supabase" | "neon";

/** Select explicitly first; otherwise preserve Supabase as the production default. */
export function selectedStorageBackend(
  env: Record<string, string | undefined> = process.env,
): StorageBackend {
  const requestedBackend = env.QWT_STORAGE_BACKEND?.toLowerCase();

  if (
    requestedBackend === "local" ||
    requestedBackend === "supabase" ||
    requestedBackend === "neon"
  ) {
    return requestedBackend;
  }

  if (env.SUPABASE_URL || env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  if (env.DATABASE_URL) return "neon";
  return "local";
}
