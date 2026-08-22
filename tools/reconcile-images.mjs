import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";

const MAX_BYTES = 10 * 1024 * 1024;
const KEY = /^committed\/([A-Za-z0-9_-]{43})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(png|jpg|webp)$/i;
const MIME = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

function assertWorkerUrl(value) {
  try { const url = new URL(value); if (url.protocol === "http:" || url.protocol === "https:") return url; } catch {}
  throw new Error("IMAGE_WORKER_URL must be an HTTP(S) URL.");
}

/** @param {Record<string, string | undefined>} env */
export function selectedBackend(env = process.env) {
  const requested = env.QWT_STORAGE_BACKEND?.toLowerCase();
  if (requested === "local") return "local";
  if (requested === "neon") return "neon";
  return env.DATABASE_URL ? "neon" : "local";
}

export function validateReference(value) {
  if (!value || typeof value !== "object" || value.version !== 1 || typeof value.objectKey !== "string" || typeof value.etag !== "string" || value.etag.length < 1 || value.etag.length > 256 || !Number.isSafeInteger(value.byteSize) || value.byteSize < 1 || value.byteSize > MAX_BYTES || !Object.values(MIME).includes(value.contentType)) throw new Error("Malformed image reference.");
  const match = KEY.exec(value.objectKey);
  if (!match || MIME[match[3].toLowerCase()] !== value.contentType) throw new Error("Invalid committed image key.");
  return { ...value, sessionHash: match[1], submissionId: match[2] };
}

export function validateWorkerObject(object) {
  if (!object || typeof object.key !== "string" || typeof object.etag !== "string" || object.etag.length < 1 || object.etag.length > 256 || typeof object.uploaded !== "string" || !/^\d{4}-\d\d-\d\dT/.test(object.uploaded) || !Number.isFinite(Date.parse(object.uploaded)) || !Number.isSafeInteger(object.size) || object.size < 1 || object.size > MAX_BYTES || !Object.values(MIME).includes(object.contentType)) throw new Error("Malformed Worker object.");
  const match = KEY.exec(object.key);
  if (!match || MIME[match[3].toLowerCase()] !== object.contentType) throw new Error("Malformed Worker object.");
  return object;
}

export async function collectWorkerObjects(fetchImpl, workerUrl, token) {
  const all = []; const seen = new Set(); let cursor = null;
  do {
    const url = new URL("/internal/images", workerUrl); url.searchParams.set("limit", "1000"); if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) throw new Error(`Worker list failed (${response.status}).`);
    const page = await response.json();
    if (!page || !Array.isArray(page.objects) || typeof page.truncated !== "boolean" || (page.cursor !== null && typeof page.cursor !== "string")) throw new Error("Malformed Worker list page.");
    all.push(...page.objects.map(validateWorkerObject));
    if (!page.truncated) { if (page.cursor !== null) throw new Error("Malformed final Worker page."); break; }
    if (!page.cursor || seen.has(page.cursor)) throw new Error("Incomplete Worker pagination.");
    seen.add(page.cursor); cursor = page.cursor;
  } while (true);
  return all;
}

/** The CLI runs outside Next, so this is intentionally a direct SQL scan. */
export async function collectNeonReferences(databaseUrl, sqlFactory = neon) {
  if (!databaseUrl) throw new Error("Neon reconciliation requires DATABASE_URL.");
  const sql = sqlFactory(databaseUrl);
  const rows = await sql.query("SELECT image_data FROM qwt_submissions WHERE image_data IS NOT NULL ORDER BY id ASC");
  if (!Array.isArray(rows)) throw new Error("Malformed Neon reference scan.");
  return rows.map((row) => validateReference(row.image_data));
}

export function planReconciliation(references, objects, now = Date.now()) {
  const refs = new Map(); for (const ref of references) { if (refs.has(ref.objectKey)) throw new Error("Duplicate committed image reference."); refs.set(ref.objectKey, ref); }
  const worker = new Map(); for (const object of objects) { if (worker.has(object.key)) throw new Error("Duplicate Worker object."); worker.set(object.key, object); }
  const missing = []; for (const ref of refs.values()) { const object = worker.get(ref.objectKey); if (!object) missing.push(ref); else if (object.etag !== ref.etag || object.contentType !== ref.contentType || object.size !== ref.byteSize) throw new Error("Committed image metadata mismatch; reconciliation aborted."); }
  return { missing, stale: [...worker.values()].filter((object) => !refs.has(object.key) && now - Date.parse(object.uploaded) > 86400000) };
}

async function collectReferences() {
  if (selectedBackend() === "local") { const data = JSON.parse(await readFile(new URL("../.data/qwt-store.json", import.meta.url), "utf8")); return (data.submissions ?? []).flatMap((submission) => submission.imageData ? [validateReference(submission.imageData)] : []); }
  if (selectedBackend() === "neon") return collectNeonReferences(process.env.DATABASE_URL);
}

async function main() {
  loadEnvConfig(process.cwd());
  const args = process.argv.slice(2); if (args.length > 1 || (args.length && args[0] !== "--delete")) throw new Error("Usage: npm run reconcile-images [-- --delete]");
  const workerUrl = assertWorkerUrl(process.env.IMAGE_WORKER_URL); const token = process.env.IMAGE_WORKER_SERVICE_TOKEN;
  if (!token || token.length < 32 || token.length > 4096) throw new Error("IMAGE_WORKER_SERVICE_TOKEN must be 32–4096 characters.");
  const [references, objects] = await Promise.all([collectReferences(), collectWorkerObjects(fetch, workerUrl, token)]);
  const plan = planReconciliation(references, objects);
  console.log(JSON.stringify({ references: references.length, objects: objects.length, missingReferences: plan.missing.length, unreferencedOlderThan24h: plan.stale.length, mode: args[0] === "--delete" ? "delete" : "dry-run" }));
  if (args[0] !== "--delete") return;
  if (plan.missing.length) throw new Error("Referenced committed images are missing; deletion refused.");
  for (const object of plan.stale) { const [, sessionHash, submissionId, extension] = KEY.exec(object.key); const response = await fetch(new URL("/internal/delete", workerUrl), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ sessionHash, submissionId, contentType: MIME[extension.toLowerCase()], etag: object.etag }), cache: "no-store" }); if (!response.ok) throw new Error(`Delete failed (${response.status}); reconciliation stopped.`); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
