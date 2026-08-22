export type StorageBackend = "local" | "neon";

/** Select explicitly first; otherwise fall back to Neon, then local. */
export function selectedStorageBackend(
  env: Record<string, string | undefined> = process.env,
): StorageBackend {
  const requestedBackend = env.EDIE_STORAGE_BACKEND?.toLowerCase();

  if (requestedBackend === "local" || requestedBackend === "neon") {
    return requestedBackend;
  }

  if (env.DATABASE_URL) return "neon";
  return "local";
}
