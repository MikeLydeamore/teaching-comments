# Private submission-image gateway

This Worker is the only image-data path. `IMAGES` is a private R2 binding; do not enable an `r2.dev` URL, a public bucket/custom domain, R2 API credentials in the app, or any direct client-to-R2 access.

## Setup

Create the private Standard production bucket in the Oceania location hint:

```sh
npx wrangler r2 bucket create edie-submission-images --location oc --storage-class Standard
```

`wrangler dev` uses a local simulated R2 bucket by default; it does not require or reference a real preview bucket. For a deliberate remote-development workflow, add a separately created private `preview_bucket_name` binding only after creating that bucket.

Configure an R2 lifecycle rule only for prefix `pending/`, expiring objects after one day. R2 lifecycle execution is asynchronous, so an eligible object can be deleted at any point in the following 24 hours. Finalized pending objects are intentionally retained as immutable replay tombstones until that lifecycle cleanup, which can temporarily duplicate a committed image for up to roughly 48 hours. Do not attach a lifecycle rule to `committed/`.

```sh
npx wrangler r2 bucket lifecycle add edie-submission-images expire-pending pending/ --expire-days 1
npx wrangler r2 bucket lifecycle list edie-submission-images
```

Replace the two `namespace_id` values in `wrangler.jsonc` with distinct positive-integer namespace IDs allocated in the Cloudflare account. They deliberately start as documented placeholder IDs and must not be shared unless shared counters are intended.

Set the required Worker secrets and the exact, comma-separated browser origin allowlist:

```sh
npx wrangler secret put TICKET_SECRET
npx wrangler secret put SERVICE_TOKEN
# Edit ALLOWED_ORIGINS in wrangler.jsonc, for example https://app.example.edu,https://preview.example.edu
```

For local development, copy `.dev.vars.example` to `.dev.vars`, replace both values with separate random strings of at least 32 characters, then run `npm run dev`. The Worker fails closed when either secret is shorter than 32 characters or when `ALLOWED_ORIGINS` is empty or not a comma-separated list of exact HTTP(S) origins.

`TICKET_SECRET` signs the ASCII `base64url(JSON).base64url(HMAC-SHA-256(firstPart))` capability tickets. Never place tickets or either secret in logs, URLs outside the intended worker request, source control, or client-side configuration.

## Commands

```sh
npm install
npm test
npm run typecheck
npm run dev
npm run deploy
```

Use `npx wrangler deploy --dry-run` to build and inspect bindings without deploying.

## Production deployment and rollback

Deploy in this order:

1. Create `edie-submission-images`, apply the `pending/` lifecycle command above, and keep every public access option disabled. Confirm in the R2 dashboard that neither an `r2.dev` public-development URL nor a custom public domain is enabled.
2. Replace both rate-limit namespace IDs, set the Worker secrets, and set the production `ALLOWED_ORIGINS` value.
3. Run `npm test`, `npm run typecheck`, then `npx wrangler deploy --dry-run` from this directory.
4. Deploy the Worker with `npm run deploy`.
5. Configure the Next application with the matching Worker URL, service token, ticket secret, and `IMAGE_UPLOADS_ENABLED=true`, then deploy Next. The Worker must be live before enabling the Next feature.

For local coordination, start this package with `npm run dev` and point the local Next application at the printed Worker URL. Use matching local `IMAGE_TICKET_SECRET` / `IMAGE_WORKER_SERVICE_TOKEN` values in Next and `.dev.vars` here; set Next's `IMAGE_UPLOADS_ENABLED=true` only while both are running.

To roll back, first deploy or configure Next with `IMAGE_UPLOADS_ENABLED=false` so it stops minting capabilities and calling the Worker. The deployed Worker and private bucket data are retained; do not delete the bucket or committed objects as part of a feature rollback.

The `CLIENT_RATE` (10/minute by `clientId:sessionHash`) and `SESSION_RATE` (300/minute by `sessionHash`) bindings are deliberately approximate and per Cloudflare point of presence. They provide abuse resistance, not globally exact quota accounting.

## Routes

- `PUT /upload?ticket=` accepts only exact signed metadata, a matching `Content-Length`, and PNG/JPEG/WebP magic bytes, then creates an immutable `pending/` object.
- `POST /internal/finalize` and the list/delete routes require `Authorization: Bearer $SERVICE_TOKEN`; they never emit CORS headers.
- `GET /image?ticket=` reads an exact committed ETag with private no-store browser headers.
