-- Compatibility step for removing legacy membership email/status columns.
-- Apply before deploying code that inserts memberships by user ID only.
begin;

-- Preserve the old application's ON CONFLICT (space_code, email) behavior
-- after removing the legacy primary key.
create unique index if not exists edie_space_members_space_email_idx
  on edie_space_members (space_code, email);

alter table edie_space_members
  drop constraint if exists edie_space_members_pkey;

alter table edie_space_members
  alter column email drop not null,
  alter column status set default 'active';

-- A full unique index lets both the old and new application builds use
-- ON CONFLICT (space_code, user_id). PostgreSQL permits multiple NULL values,
-- so legacy pending rows remain valid until the cleanup step.
create unique index if not exists edie_space_members_space_user_idx
  on edie_space_members (space_code, user_id);

commit;
