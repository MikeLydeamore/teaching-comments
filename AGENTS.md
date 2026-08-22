<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Summary: Ed.ie (teaching-comments)

A Next.js 16 + React 19 classroom engagement app where students submit typed/drawn/GIF/image responses, group questions, and poll answers during live teaching sessions.

## Key routes (src/app/):

- /join — student entry via space + session code
- /spaces/<space>/<session> — student writing/submission page
- /host/<space>[/<session>] — PIN-protected teacher dashboard (live submissions, polls, timer, QR codes, charts)
- /admin/spaces — admin page for creating spaces/resetting PINs

## Architecture:

- src/lib/ — storage abstraction with pluggable backends: local JSON file (dev), Neon serverless Postgres (production); also teacher auth (hashed PINs), image upload tickets, and poll logic. Tests via Vitest.
- src/components/ — UI pieces: drawing pad, Giphy picker, QR popouts, poll overlays, results charts (pie/column/word cloud), response-time plots. All components start with `"use client"`.
- database/ — SQL schema for Neon/Postgres (`schema.sql`, `neon-app-role.sql`) plus incremental migrations. All tables are prefixed `edie_` (quick-write-tool legacy naming).
- workers/image-storage — Cloudflare-style worker for private image storage; a **separate npm project** with its own package.json, scripts (`npm run dev|deploy|test|typecheck`) and vitest config. Root commands do not cover it. See its README for hard constraints (R2 stays fully private, lifecycle rules only on `pending/`, secrets fail closed below 32 chars).
- tools/reconcile-images.mjs — maintenance CLI (`npm run reconcile-images`) auditing R2-committed images vs DB references.
- Deployed to Vercel (Analytics/Speed Insights), Tailwind CSS v4 styling.

Auth model: teacher spaces secured by hashed PINs; sessions are scoped per-space so identical session codes in different spaces don't share data. Optional integrations: GIPHY (public key) and private image uploads (server-only secrets).

## Commands & verification

- Verify changes with: `npm run lint && npm run build && npm test`
- Tests run via Vitest with zero config, scoped to `src/` only — colocated as `*.test.ts` next to source files.
- Local dev persistence lives in `.data/edie-store.json` (gitignored); deleting it resets all local sessions/submissions.
- `STORE_DELAY_MS=1500 npm run dev` injects artificial storage latency to test loading states.

## Storage backends

- New backends must implement the ~50-method `EdieStore` type in `src/lib/edie-store-model.ts`; dispatch happens in `getStore()` in `src/lib/edie-store.ts`.
- Backend selection precedence: explicit `EDIE_STORAGE_BACKEND` env (`local|neon`) → else Neon if `DATABASE_URL` set → else local JSON file.
- All domain types, validators, and size limits live centrally in `edie-store-model.ts` (submissions ≤2000 chars, drawings ≤120 strokes, polls 2–8 options, etc.). Route handlers must call these rather than re-validating.
- `SubmissionImageData` must never be sent to client components — use the `SubmissionDto` mapping instead.

## Testing patterns

- Server-only modules require `vi.mock("server-only", () => ({}))` in unit tests.
- Neon store tests use a hoisted query mock pattern-matching SQL statement prefixes (e.g. `SELECT`, `INSERT INTO edie_submissions`). Follow this idiom for any new backend tests.

## Next.js 16 API conventions

- Route handlers use the typed `RouteContext<"/api/...">` context param with async params — always `await ctx.params`.
- Teacher routes authorize through `getAuthorizedTeacherSession(sessionCode)` returning `{ response?, session }`.
- Server-side data libs import `"server-only"` (a dependency).

## Environment variables

- Required for deployment: `TEACHER_PIN`, `ADMIN_PIN`, `TEACHER_AUTH_SECRET`. Dev fallback PIN is `teach123` when unset; `ADMIN_PIN` falls back to `TEACHER_PIN`.
- `DATABASE_URL` is server-only pooled Neon URL — never expose with a `NEXT_PUBLIC_` prefix.
- Image uploads fail closed unless ALL of `IMAGE_UPLOADS_ENABLED=true`, `IMAGE_WORKER_URL`, `IMAGE_WORKER_SERVICE_TOKEN`, `IMAGE_TICKET_SECRET` are set (secrets ≥32 chars).
- `NEXT_PUBLIC_GIPHY_API_KEY` is browser-exposed by design.
