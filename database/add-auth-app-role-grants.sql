-- Run as the Neon project owner after database/auth-schema.sql.
-- This lets previews use their integration-provided edie_app DATABASE_URL for
-- Better Auth without giving the application an owner connection.
grant select, insert, update, delete on table
  "user",
  "session",
  "account",
  "verification"
to edie_app;
