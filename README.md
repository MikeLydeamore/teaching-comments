# Ed.ie

Ed.ie is a live classroom engagement app. Teachers can open sessions, set
prompts, run polls, collect questions, and review responses as they arrive.
Students join anonymously with a space and session code and can respond with
text, drawings, GIFs, or images.

## What it includes

- Google and GitHub sign-in for teachers, with no password accounts
- Hosted spaces shared with owners and editors
- Anonymous student access through a join code or QR code
- Live prompts, countdown timers, polls, and group questions
- Moderation, filtering, charts, response-time plots, and CSV export
- Local JSON storage for development and PostgreSQL for deployments
- Optional Redis-backed live updates, GIPHY search, and private image uploads

## Requirements

- Node.js 20.9 or newer
- npm
- Docker, or another PostgreSQL server, for local teacher authentication
- A PostgreSQL database and `psql` client for a production deployment
- At least one Google or GitHub OAuth application for teacher sign-in

## Local development

Install dependencies and create your local environment file:

```bash
npm install
cp .env.example .env.local
```

The application data uses a local JSON file by default. Teacher accounts use
PostgreSQL, so start the included database and create the auth tables:

```bash
docker compose up -d
docker exec -i edie-auth-postgres psql -U edie -d edie_auth \
  < database/auth-schema.sql
```

Add either Google or GitHub credentials to `.env.local`. Configure the OAuth
application with the matching local callback URL:

```text
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/callback/github
```

Only the provider you enable needs a callback URL. Then start Ed.ie:

```bash
npm run dev
```

Open `http://localhost:3000`. Useful entry points are:

- `/join` — student join page
- `/spaces/default/demo-lecture` — seeded student session
- `/host` — teacher home
- `/admin/spaces` — administration for emails in `ADMIN_EMAILS`

Local application data is stored in `.data/edie-store.json`. Delete that file
to reset the local spaces, sessions, and responses. The Docker volume stores
teacher accounts separately.

## Production deployment

The following is the fresh-install path. The SQL files named `add-*`,
`prepare-*`, `finish-*`, `drop-*`, and `migrate-*` are incremental migrations
for older installations and are not needed for a new deployment.

### 1. Create the database

Create a PostgreSQL database. With an owner connection, apply the application
and authentication schemas:

```bash
psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 -f database/auth-schema.sql
```

For least-privilege application access, create the `edie_app` role and its
grants:

```bash
psql "$DATABASE_OWNER_URL" -v ON_ERROR_STOP=1 -f database/db-app-role.sql
```

Assign `edie_app` a strong password through your database administration tool,
then use its pooled connection URL as `DATABASE_URL`. The owner URL is only for
schema administration and must not be configured in the deployed application.
Auth tables use the same database by default; set `AUTH_DATABASE_URL` only when
they live in a separate PostgreSQL database.

If auth uses a separate database, apply `database/auth-schema.sql` there and
give the application connection read/write access to the four auth tables.

### 2. Configure OAuth

Create a Google or GitHub OAuth application and register the production
callback URL for each enabled provider:

```text
https://your-domain.example/api/auth/callback/google
https://your-domain.example/api/auth/callback/github
```

Preview deployments need their own allowed callback URLs if teacher sign-in
must work on previews.

### 3. Configure the application

Configure these environment variables in your deployment platform:

```text
DATABASE_URL=postgresql://edie_app:...@.../...?...pooling-options
BETTER_AUTH_SECRET=a-random-secret-at-least-32-characters-long
BETTER_AUTH_URL=https://your-domain.example

# Configure at least one complete provider pair.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Optional comma-separated allow-list for /admin/spaces.
ADMIN_EMAILS=you@example.com
```

Keep `DATABASE_URL`, `BETTER_AUTH_SECRET`, OAuth client secrets, and all image
upload credentials server-only. Do not give them a `NEXT_PUBLIC_` prefix.

Deploy the project, visit `/host`, and sign in. A teacher's personal
organization is created during onboarding, after they choose a username.

## Optional integrations

### Realtime updates

Set `REDIS_URL` to a Redis connection URL to enable Server-Sent Events for new
submissions and the approximate connected-student count:

```text
REDIS_URL=rediss://...
```

PostgreSQL remains the source of truth; Redis carries invalidation and
short-lived presence data, not response content. Without Redis, the dashboard
automatically falls back to polling every three seconds. Removing `REDIS_URL`
and redeploying is a safe way to disable realtime delivery.

### GIF search

Set a GIPHY browser API key:

```text
NEXT_PUBLIC_GIPHY_API_KEY=your-giphy-api-key
```

This value is browser-visible by design. If it is absent, GIF search is
disabled.

### Private image responses

Image responses use a separate gateway and private object store. Follow
[`workers/image-storage/README.md`](workers/image-storage/README.md) to deploy
that service first, then configure the Next.js application:

```text
IMAGE_UPLOADS_ENABLED=true
IMAGE_WORKER_URL=https://your-image-worker.example
IMAGE_WORKER_SERVICE_TOKEN=a-random-token-at-least-32-characters-long
IMAGE_TICKET_SECRET=a-random-secret-at-least-32-characters-long
```

All four values are required; image uploads fail closed if the configuration
is incomplete. The worker service token and ticket secret must match the
worker's secrets.

## Storage selection

Ed.ie uses PostgreSQL when `DATABASE_URL` is present and local JSON otherwise.
You can force local development storage with `EDIE_STORAGE_BACKEND=local`.
Local storage is not suitable for deployments without a durable filesystem.

Session codes are unique within a hosted space. Two spaces can use the same
session code without sharing responses, questions, or polls.

## Verification

Run the full project checks before deploying:

```bash
npm run lint
npm run build
npm test
```

The private image worker is a separate npm project with its own tests and
type-check command; see its README for details.

## Main routes

- `/join` — enter a space and session code
- `/spaces/<space>/<session>` — student session
- `/host` — teacher spaces
- `/host/<space>` — hosted-space dashboard
- `/host/<space>/<session>` — live session dashboard
- `/host/<space>/settings` — owner-only access management
- `/admin/spaces` — administration gated by `ADMIN_EMAILS`
- `/privacy` — student privacy notice

Teachers must sign in and have a space membership. Owners can manage members;
editors can run sessions and moderate responses. Students do not need accounts.
