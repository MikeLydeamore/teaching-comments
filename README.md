# Ed.ie

Ed.ie is a classroom helper for questions, short responses, drawings, polls,
and live check-ins.

This includes:

- a student writing page at `/spaces/default/demo-lecture`
- a student join page at `/join`
- a host dashboard at `/host/default/demo-lecture`
- host-generated QR codes for the student session link
- teacher accounts via Google/GitHub OAuth (no passwords)
- teacher spaces with owner/editor sharing by private username or email invitation
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

For a hosted deployment, you will need a PostgreSQL Server. The schema is in
`database/schema.sql` and permissions are set in `database/db-app-role.sql`.

When upgrading a database created before teacher accounts, apply these
idempotent migrations in order with the database owner connection:

```bash
psql "$DATABASE_OWNER_URL" < database/drop-space-pins.sql
psql "$DATABASE_OWNER_URL" < database/add-space-members.sql
psql "$DATABASE_OWNER_URL" < database/add-space-invitations.sql
psql "$DATABASE_OWNER_URL" < database/add-organizations.sql
```

The first migration removes the legacy PIN requirement. The next two create the
legacy-compatible account ACL, and `add-organizations.sql` expands it with
stable user IDs, separate invitations, and the invisible customer boundary.

Audit live data before applying the organization backfill. This command is a
dry run unless `--apply` is supplied, and it makes no changes if a space is
ownerless, has multiple owners, or an active member cannot be mapped to a
Better Auth account:

```bash
DATABASE_OWNER_URL="$DATABASE_OWNER_URL" AUTH_DATABASE_URL="$AUTH_DATABASE_URL" \
  npm run migrate-organizations
DATABASE_OWNER_URL="$DATABASE_OWNER_URL" AUTH_DATABASE_URL="$AUTH_DATABASE_URL" \
  npm run migrate-organizations -- --apply
psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 \
  -f database/require-space-organizations.sql
```

When auth and application tables share a database, `DATABASE_URL` can be used
for both connections. Pause space creation, invitation acceptance, and access
changes between the final successful `--apply` run and deployment of the new
application, then rerun the dry-run if the deployment is delayed.

After validating the organization deployment, pause space creation and member
or invitation changes, then finish the user-ID membership cutover. The
preparation migration is compatible with both application builds:

```bash
psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 \
  -f database/prepare-membership-user-id-cutover.sql
```

Deploy the application version that no longer reads or writes membership email
or status fields, then immediately apply the contract migration with the
table-owner connection:

```bash
psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 \
  -f database/finish-membership-user-id-cutover.sql
```

The contract migration aborts if an active membership lacks a user ID or a
legacy pending row has no corresponding entry in `edie_space_invitations`.
Afterward, `edie_space_members` is keyed only by `(space_code, user_id)`; an
invitation row itself represents pending status. Resume changes and test space
creation, invitations, acceptance, and access only after this contract step.

Set these environment variables locally and in Vercel:

```text
EDIE_STORAGE_BACKEND=<your-hosting>
DATABASE_URL=https://your-project-ref.
BETTER_AUTH_SECRET=replace-with-a-random-secret-at-least-32-characters-long
BETTER_AUTH_URL=https://your-deployed-origin
AUTH_DATABASE_URL=<optional-separate-auth-postgres-url>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ADMIN_EMAILS=you@example.com
```

## Realtime submission updates

The host dashboard and submissions popout use an authenticated Server-Sent
Events stream for fast cross-device updates. The postgres database remains the source of
truth; Redis carries only versioned invalidation notices and never contains
student response content.

When `REDIS_URL` is absent or Redis cannot be reached, both screens display a
`Polling` badge and automatically return to three-second submission polling.
Other live features keep their existing refresh behavior.

The dashboard and submissions popout also show an approximate connected-student
count. Visible student forms add an anonymous browser identifier to an ephemeral
Redis presence set at most once every 10 seconds. Identifiers not seen for 25
seconds are excluded and removed when the host count is read. The count continues
while submissions are closed, contains no names or response content, and displays
as unavailable when Redis is not configured or cannot be reached.


Monitor usage in Vercel under **Observability → Functions** (provisioned
memory, active CPU, and invocations) and in the Upstash console under the
database's usage metrics (commands, connections, and bandwidth). Configure
Vercel spend management and an Upstash budget before moving to paid usage.

To roll back realtime delivery without reverting code, remove `REDIS_URL` from
the affected Vercel environment and redeploy. The application will continue to
work through polling.

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
signed-in account with a stable user-ID membership row in
`edie_space_members`:

- **owner** — full access, can share the space and manage members
- **editor** — run live sessions and moderate responses

Every teacher chooses a unique username after their first OAuth sign-in. Space
owners can invite an existing teacher by exact username, without seeing their
sign-in email, or use an email address for someone who has not joined Ed.ie yet.
Invitations live separately in `edie_space_invitations` and remain pending until
the invited teacher accepts them. Every teacher receives an invisible personal
organization after username onboarding, and every hosted space belongs to one
organization so future entitlements have a durable customer boundary.

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

Existing auth databases created before usernames must apply the incremental
migration before deploying username-aware code:

```bash
psql "$AUTH_DATABASE_URL" < database/add-auth-usernames.sql
```

In Neon, `AUTH_DATABASE_URL` is optional when the Better Auth tables share the
application database. Apply `database/auth-schema.sql`, then run
`database/add-auth-app-role-grants.sql` as the project owner. The restricted
`edie_app` role can then use the deployment's `DATABASE_URL` for both the Ed.ie
and Better Auth tables. An explicit `AUTH_DATABASE_URL` still takes precedence
when auth uses a separate database. Apply `database/add-auth-usernames.sql` to
each existing local, Preview, and Production auth database before deployment.
