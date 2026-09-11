# Realtime Submission View via SSE and Redis

## Summary

Replace the submissions view's continuous 3-second polling with authenticated Server-Sent Events backed by Upstash Redis Pub/Sub. Redis carries only invalidation notices; Neon and the existing `/submission-view` endpoint remain the source of truth.

Healthy cross-device updates should normally appear within one second. If realtime is unavailable, clients automatically resume the existing 3-second polling.

## Interfaces and Architecture

- Add `GET /api/sessions/[sessionCode]/submission-view/events`.
  - Authenticate with `getAuthorizedTeacherSession`.
  - Return `text/event-stream` with no-cache/no-buffer headers.
  - Use the Node.js runtime and recycle gracefully before Hobby's 300-second limit.
- Define versioned SSE events: `ready`, `submission-view-invalidated`, `degraded`, and `reconnect`.
- Send heartbeats every 15 seconds and an initial padded comment for buffering-sensitive clients.
- Use a session-scoped Redis channel based on the internal session ID.
- Send no student names, responses, media, or other personal data through Redis.
- Add the optional server-only `REDIS_URL` variable and `ioredis` dependency. No database migration is required.

## Implementation Changes

- Publish invalidations after successful submission creation/edit/visibility changes, display-setting changes, relevant session updates, and archive/restore operations.
- Keep publication best-effort: Redis failure must not fail an already committed database write.
- Add a shared client subscription controller for the dashboard and popout:
  - Refetch canonical state after connection, reconnection, invalidation, browser-online, and visibility events.
  - Coalesce concurrent or bursty refresh requests.
  - Stop submission polling while SSE is healthy.
  - Resume 3-second polling only while connecting or degraded.
- Show a compact `Live`, `Reconnecting`, or `Polling` badge.
- Preserve existing revision checks, optimistic controls, view transitions, DTO protections, and unrelated polling intervals.
- Without Redis configuration, transparently retain the existing polling behavior.

## Guided Upstash and Vercel Setup

- Walk through the Vercel Marketplace Upstash integration rather than requiring a separately managed setup.
- Select an Upstash region close to the Neon database and Vercel function region.
- Start with Upstash's free Redis tier and review its limits before confirmation.
- Connect the Redis resource only to the intended Vercel project and environments.
- Confirm that Vercel created or received the required server-only `REDIS_URL`; never copy credentials into chat.
- Enable Fluid Compute if the existing Hobby project does not already have it enabled.
- Redeploy after environment-variable changes.
- Verify the SSE endpoint, status badge, remote updates, reconnect behavior, and polling fallback.
- Monitor Vercel memory/invocations and Upstash command usage, and set spending alerts when moving to paid plans.
- Document setup and rollback in the repository README. Removing Redis must safely restore polling.

## Test Plan

- Unit-test event serialization, channel isolation, heartbeat/recycle cleanup, publisher coverage, and Redis-error transitions.
- Verify unauthorized and cross-session event-stream requests are rejected.
- Ensure validation failures do not publish and Redis failures do not fail successful writes.
- Test connection, invalidation bursts, degraded polling, reconnection, visibility resync, and component cleanup.
- Verify on separate browser contexts/devices that submissions, hide/show, expand/collapse, edits, filters, sorting, and archive/restore normally update within one second.
- Disable Redis and confirm both clients switch to `Polling` without losing functionality.
- Run `npm run lint && npm run build && npm test`.

## Assumptions

- Fewer than 25 host/dashboard/popout connections are normally active.
- Polling is used only while realtime is connecting or degraded; there is no safety poll while healthy.
- Expected initial infrastructure cost fits the Hobby allowances: Vercel includes 360 GB-hours and Upstash includes 500,000 Redis commands monthly. Actual use will be monitored.
- The default setup uses a Vercel-managed Upstash integration; an existing Upstash account can be connected instead if preferred.
