<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Summary: Ed.ie (teaching-comments)

A Next.js 16 + React 19 classroom engagement app where students submit typed/drawn/GIF/image responses, group questions, and poll answers during live teaching sessions.
`
## Key routes (src/app/):

- /join — student entry via space + session code
- /spaces/<space>/<session> — student writing/submission page
- /host/<space>[/<session>] — PIN-protected teacher dashboard (live submissions, polls, timer, QR codes, charts)
- /admin/spaces — admin page for creating spaces/resetting PINs

## Architecture:

- src/lib/ — storage abstraction with pluggable backends: local JSON file (dev), Neon serverless Postgres (production), plus a Supabase store; also teacher auth (hashed PINs), image upload tickets, and poll logic. Tests via Vitest.
- src/components/ — UI pieces: drawing pad, Giphy picker, QR popouts, poll overlays, results charts (pie/column/word cloud), response-time plots.
- database/ & supabase/ — SQL schemas and incremental migrations.
- workers/image-storage — Cloudflare-style worker for private image storage.
- Deployed to Vercel (Analytics/Speed Insights), Tailwind CSS v4 styling.

Auth model: teacher spaces secured by hashed PINs; sessions are scoped per-space so identical session codes in different spaces don't share data. Optional integrations: GIPHY (public key) and private image uploads (server-only secrets)