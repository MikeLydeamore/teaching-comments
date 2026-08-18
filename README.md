# Ed.ie

Ed.ie is a classroom helper for questions, short responses, drawings, polls,
and live check-ins.

This includes:

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
- A PostgreSQL schema for holding responses

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

For a hosted deployment, you will need a PostgreSQL Server. The schema is in `database/schema.sql` and permissions set in `database/neon-app-role.sql`.

Set these environment variables locally and in Vercel:

```text
QWT_STORAGE_BACKEND=<your-hosting>
DATABASE_URL=https://your-project-ref.
TEACHER_PIN=replace-with-a-private-pin-before-deploying
ADMIN_PIN=replace-with-a-private-admin-pin-before-deploying
TEACHER_AUTH_SECRET=replace-with-a-random-cookie-secret-before-deploying
```
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
