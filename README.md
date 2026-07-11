# Quick Write Tool prototype

A zero-cost first prototype of a live formative writing tool for large classes.

The current slice includes:

- a student writing page at `/s/default/demo-lecture`
- a student join page at `/join`
- a teacher dashboard at `/teacher/default/demo-lecture`
- teacher spaces with an admin-created space PIN
- a prototype admin page at `/admin/spaces` for creating spaces and resetting space PINs
- in-session prompt editing from the teacher dashboard
- per-session prompt history with response filtering by prompt
- per-session teacher question banks for saved prompts
- teacher-controlled countdown timer shown to students
- a student privacy notice checkbox
- a privacy notice page at `/privacy`
- typed and drawn student responses
- optional GIF responses through GIPHY search
- optional student display names, defaulting to Anonymous
- student group questions with shared upvoting, teacher-visible asker names, and teacher answered/re-show controls
- teacher-facing submission cards
- recent-submission filtering
- star, flag, and hide controls
- starred-only view filtering
- teacher CSV export for submissions and group questions
- clear/archive control with undo for hiding current live responses while keeping exports
- newest/oldest sorting and drag-and-drop card ordering in the teacher dashboard
- simple word-frequency summary
- column and pie charts for short poll-style responses
- word cloud charts for common words in typed responses
- response-time plotting from the latest prompt update
- local JSON storage for development
- optional Supabase storage for hosting

## Run locally

```bash
npm run dev
```

Open:

- `http://localhost:3000`
- `http://localhost:3000/join`
- `http://localhost:3000/s/default/demo-lecture`
- `http://localhost:3000/teacher`
- `http://localhost:3000/admin/spaces`
- `http://localhost:3000/teacher/default`
- `http://localhost:3000/teacher/default/demo-lecture`

## Verify

```bash
npm run lint
npm run build
```

## Storage

For the first local prototype, submissions are stored in `.data/qwt-store.json`.
This keeps the first step free and fast to iterate on.

For a hosted prototype, use Supabase Postgres so data survives Vercel server
restarts and can be managed outside the app:

1. Create a free Supabase project.
2. Open the Supabase SQL editor and run `supabase/schema.sql`.
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

GIF search is optional. To enable it, create a GIPHY API key and set:

```text
NEXT_PUBLIC_GIPHY_API_KEY=your-giphy-api-key
```

GIPHY's browser API key is public by design, unlike the Supabase service role
key.

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

## Sessions

Students join with a space code and session code on `/join` or by opening
`/s/<space-code>/<session-code>`. Student routes and submission APIs only
accept existing open sessions. Teachers create sessions by opening a session
from `/teacher/<space-code>` after entering that space's teacher PIN.

For this prototype, session codes are still globally unique internally even
though access and navigation are scoped by teaching space.

## Teacher Spaces And PINs

The local prototype defaults to this admin PIN and default-space PIN:

```text
teach123
```

Set `ADMIN_PIN` before deploying anywhere public. If `ADMIN_PIN` is not set,
the app falls back to `TEACHER_PIN` for compatibility with the earlier
prototype setup. Space PINs are created and reset from `/admin/spaces`, then
stored hashed in the database.

## Next steps

1. Add basic rate limiting for student submissions.
2. Deploy the app to Vercel with the Supabase environment variables.
3. Add response editing/version history.
4. Add peer comparison and ranking views.
