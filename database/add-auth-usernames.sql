-- Run as the auth database owner before deploying username-aware application code.
-- Existing accounts remain valid and choose a username on their next host/admin visit.
alter table "user" add column if not exists "username" text;
alter table "user" add column if not exists "displayUsername" text;

create unique index if not exists "user_username_uidx" on "user" ("username");
