# Ed.ie

Ed.ie is a classroom helper for questions, short responses, drawings, polls,
and live check-ins.

The current slice includes:

- a student writing page at `/spaces/default/demo-lecture`
- a student join page at `/join`
- a host dashboard at `/host/default/demo-lecture`
- host-generated QR codes for the student session link
- teacher spaces with an admin-created space PIN
- an admin page at `/admin/spaces` for creating spaces and resetting space PINs
- in-session prompt editing from the host dashboard
- per-session prompt history with response filtering by prompt
- per-session teacher question banks for saved prompts
- host-controlled countdown timer shown to students
- a student privacy notice checkbox
- a privacy notice page at `/privacy`
- typed and drawn student responses
- optional GIF responses through GIPHY search
- optional private student image responses (PNG/JPEG/WebP, with local HEIC conversion)
- optional student display names, defaulting to Anonymous
- student group questions with shared upvoting, host-visible asker names, and host answered/re-show controls
- host-facing submission cards
- recent-submission filtering
- star, flag, and hide controls
- starred-only view filtering
- host CSV export for submissions and group questions
- clear/archive control with undo for hiding current live responses while keeping exports
- newest/oldest sorting and drag-and-drop card ordering in the host dashboard
- simple word-frequency summary
- column and pie charts for short poll-style responses
- word cloud charts for common words in typed responses
- response-time plotting from the latest prompt update
- local JSON storage for development
- optional Supabase or Neon PostgreSQL storage for hosting

## Run locally

```bash
npm run dev
```

Open:

- `http://localhost:3000`
- `http://localhost:3000/join`
- `http://localhost:3000/spaces/default/demo-lecture`
- `http://localhost:3000/host`
- `http://localhost:3000/admin/spaces`
- `http://localhost:3000/host/default`
- `http://localhost:3000/host/default/demo-lecture`

## Verify

```bash
npm run lint
npm run build
npm test
```

## Storage

For local development, submissions are stored in `.data/qwt-store.json`.
This keeps the first step free and fast to iterate on.

For a hosted deployment, use Supabase Postgres so data survives Vercel server
restarts and can be managed outside the app:

1. Create a free Supabase project.
2. Open the Supabase SQL editor and run `database/schema.sql`.
3. Set these environment variables locally and in Vercel:

```text
QWT_STORAGE_BACKEND=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TEACHER_PIN=replace-with-a-private-pin-before-deploying
ADMIN_PIN=replace-with-a-private-admin-pin-before-deploying
TEACHER_AUTH_SECRET=replace-with-a-random-cookie-secret-before-deploying
```

Keep the service role key server-side only. Do not put it in browser code or
commit it to the repo.

### Neon development migration (safe first step)

Neon is opt-in. Existing deployments continue to use Supabase whenever its
environment variables exist, even if the host injects `DATABASE_URL`. Only an
explicit `QWT_STORAGE_BACKEND=neon` switches the application.

1. Create a Neon project and a separate development branch.
2. In that branch's SQL editor (or through its **unpooled owner** URL), apply
   `database/schema.sql` and then `database/neon-app-role.sql`. Set a strong
   password for `qwt_app` in the SQL editor separately.
3. Put the branch's **pooled**, `qwt_app`-authenticated URL in `.env.local`:

```text
QWT_STORAGE_BACKEND=neon
DATABASE_URL=postgresql://qwt_app:your-password@your-pooled-neon-host/neondb?sslmode=require
```

4. Run `npm run dev`, exercise the app, and run `npm test`. `DATABASE_URL`
   stays server-side; it must never be exposed as `NEXT_PUBLIC_*`.
5. If desired, configure these two settings for Vercel **Preview** only. Leave
   the Production Supabase settings and `QWT_STORAGE_BACKEND` unchanged until
   a separately planned cutover.

`npm run reconcile-images` loads the usual `.env*` files and supports local,
Supabase, and Neon reference scans. It remains dry-run by default.

For a later production cutover, schedule a write-freeze/maintenance window for
the final Supabase export, Neon import, validation, and backend switch (or
implement and verify a delta-synchronisation process). Take a verified backup,
validate row counts and image references before opening Neon for writes, then
change only the Production backend setting. Once Neon accepts writes, a
rollback needs a planned reconciliation/copy of those Neon-side writes before
switching back to Supabase; a blind environment-variable rollback can lose
data. Do not delete either database until the import and rollback window have
been accepted.

GIF search is optional. To enable it, create a GIPHY API key and set:

```text
NEXT_PUBLIC_GIPHY_API_KEY=your-giphy-api-key
```

GIPHY's browser API key is public by design, unlike the Supabase service role
key.

Private image uploads are disabled unless all of these server-only values are set:

```text
IMAGE_UPLOADS_ENABLED=true
IMAGE_WORKER_URL=https://your-private-image-worker.example
IMAGE_WORKER_SERVICE_TOKEN=a-random-service-token-at-least-32-characters-long
IMAGE_TICKET_SECRET=a-random-secret-at-least-32-characters-long
```

Run `supabase/add-submission-image-data.sql` for existing Supabase databases.
See [the image storage Worker guide](workers/image-storage/README.md) for the
bucket, lifecycle, deployment, and rollback steps.
The Worker owns short-lived pending uploads and committed private objects; run
`npm run reconcile-images` for a dry-run reconciliation, or append `--delete`
only after reviewing a complete scan. Reconciliation never deletes archived
submission images. Configure retention separately for your teaching activity.
Cloudflare storage is selected for the Oceania region where available; this is
not an Australia-only residency guarantee. The feature is deliberately
conservative (roughly a small handful of upload allocations per student per
minute) and should be protected by platform rate limits in public deployments.

If you already ran the first schema before drawing support was added, run
`supabase/add-drawing-data.sql` in the Supabase SQL editor.

If you already ran the schema before response-time plotting was added, run
`supabase/add-prompt-timing.sql` in the Supabase SQL editor.

If you already ran the schema before prompt history was added, run
`supabase/add-prompt-history.sql` in the Supabase SQL editor.

If you already ran the schema before teacher spaces were added, run
`supabase/add-teacher-spaces.sql` in the Supabase SQL editor.

If you already ran the schema before student display names were added, run
`supabase/add-student-name.sql` in the Supabase SQL editor.

If you already ran the schema before the classroom timer was added, run
`supabase/add-session-timer.sql` in the Supabase SQL editor.

If you already ran the schema before GIF support was added, run
`supabase/add-gif-data.sql` in the Supabase SQL editor.

If you already ran the schema before per-input submission controls were added,
run `supabase/add-submission-input-controls.sql` in the Supabase SQL editor.

If you already ran the schema before question banks were added, run
`supabase/add-question-bank.sql` in the Supabase SQL editor.

If you already ran the schema before group questions were added, run
`supabase/add-group-questions.sql` in the Supabase SQL editor.

If you already ran the group-question migration before answered questions were
added, run `supabase/add-group-question-answered.sql` in the Supabase SQL editor.

If you already ran the group-question migration before asker names were added,
run `supabase/add-group-question-student-name.sql` in the Supabase SQL editor.

If you already ran the schema before clear/archive support was added, run
`supabase/add-archive-fields.sql` in the Supabase SQL editor.

If you already ran the schema before live polls were added, run
`supabase/add-live-polls.sql` in the Supabase SQL editor.

If you already ran the schema before poll question banks were added, run
`supabase/add-poll-question-bank.sql` in the Supabase SQL editor.

If you already ran the schema before session codes were scoped to teaching
spaces, run `supabase/scope-session-codes-to-spaces.sql` in the Supabase SQL
editor.

## Sessions

Students join with a space code and session code on `/join` or by opening
`/spaces/<space-code>/<session-code>`. Student routes and submission APIs only
accept existing open sessions. Teachers create sessions by opening a session
from `/host/<space-code>` after entering that space's teacher PIN.

Session codes are unique within a teaching space. Different spaces can use the
same session code without sharing responses, questions, or polls.

## Teacher Spaces And PINs

Local development defaults to this admin PIN and default-space PIN:

```text
teach123
```

Set `ADMIN_PIN` before deploying anywhere public. If `ADMIN_PIN` is not set,
the app falls back to `TEACHER_PIN` for compatibility with the earlier
setup. Space PINs are created and reset from `/admin/spaces`, then
stored hashed in the database.

## Next steps

1. Add basic rate limiting for student submissions.
2. Deploy the app to Vercel with the Supabase environment variables.
3. Add response editing/version history.
4. Add peer comparison and ranking views.
