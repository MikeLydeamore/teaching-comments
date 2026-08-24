# Ed.ie

Ed.ie is a classroom helper for questions, short responses, drawings, polls,
and live check-ins.

This includes:

- a student writing page at `/spaces/default/demo-lecture`
- a student join page at `/join`
- a host dashboard at `/host/default/demo-lecture`
- host-generated QR codes for the student session link
- teacher accounts via Google/GitHub OAuth (no passwords)
- teacher spaces with owner/editor sharing by email
- an admin page at `/admin/spaces` for admins listed in `ADMIN_EMAILS`
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

For local development, submissions are stored in `.data/edie-store.json`.
This keeps the first step free and fast to iterate on.

For a hosted deployment, you will need a PostgreSQL Server. The schema is in `database/schema.sql` and permissions set in `database/neon-app-role.sql`.
Existing databases with `edie_space_members` must also apply
`database/add-space-invitations.sql` before deploying invitation-aware code.

Set these environment variables locally and in Vercel:

```text
EDIE_STORAGE_BACKEND=<your-hosting>
DATABASE_URL=https://your-project-ref.
BETTER_AUTH_SECRET=replace-with-a-random-secret-at-least-32-characters-long
BETTER_AUTH_URL=https://your-deployed-origin
AUTH_DATABASE_URL=<postgres-url-holding-auth-tables>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ADMIN_EMAILS=you@example.com
```
GIF search is optional. To enable it, create a GIPHY API key and set:

```text
NEXT_PUBLIC_GIPHY_API_KEY=your-giphy-api-key
```

GIPHY's browser API key is public by design, unlike the server-only secrets.

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
accept existing open sessions. Students never sign in. Teachers open sessions
from their space dashboard after signing in with Google or GitHub.

Session codes are unique within a teaching space. Different spaces can use the
same session code without sharing responses, questions, or polls.

## Teacher Accounts And Spaces

Teachers sign in with Google or GitHub through Better Auth; there are no
passwords, so there are no resets to manage. Every teacher route requires a
signed-in account with a membership row in `edie_space_members`:

- **owner** — full access, can share the space and manage members
- **editor** — run live sessions and moderate responses

Members are invited by email on `/host/<space-code>/settings`; the invite
becomes active as soon as the invitee signs in with that email.

Admins are verified emails listed in `ADMIN_EMAILS` (comma-separated). They
manage all spaces from `/admin/spaces`, including claiming legacy spaces that
have no owner.

Local development uses Docker Postgres for auth tables:

```bash
docker compose up -d
AUTH_DATABASE_URL=postgres://edie:edie@localhost:5432/edie_auth \
  node tools/generate-auth-schema.mjs   # regenerate database/auth-schema.sql
docker exec -i edie-auth-postgres psql -U edie -d edie_auth \
  < database/auth-schema.sql
```
