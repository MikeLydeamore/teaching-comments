-- Phase 2 expand migration. Safe to apply before the organization backfill.
-- Existing email/status membership columns intentionally remain for rollback.
create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists edie_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  kind text not null check (kind in ('personal', 'system')),
  personal_owner_user_id text,
  created_at timestamptz not null default now(),
  check ((kind = 'personal') = (personal_owner_user_id is not null))
);

create unique index if not exists edie_organizations_personal_owner_idx
  on edie_organizations (personal_owner_user_id)
  where personal_owner_user_id is not null;

alter table edie_teacher_spaces
  add column if not exists organization_id uuid references edie_organizations(id) on delete restrict;

alter table edie_space_members
  add column if not exists user_id text;

create unique index if not exists edie_space_members_space_user_active_idx
  on edie_space_members (space_code, user_id)
  where status = 'active' and user_id is not null;

create table if not exists edie_space_invitations (
  space_code text not null references edie_teacher_spaces(code) on delete cascade,
  email citext not null check (char_length(email) between 3 and 320),
  invitee_user_id text,
  role text not null check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (space_code, email)
);

create unique index if not exists edie_space_invitations_space_user_idx
  on edie_space_invitations (space_code, invitee_user_id)
  where invitee_user_id is not null;
create index if not exists edie_space_invitations_email_idx
  on edie_space_invitations (email);

grant select, insert, update on edie_organizations to edie_app;
grant select, insert, update on edie_teacher_spaces to edie_app;
grant select, insert, update, delete on edie_space_members to edie_app;
grant select, insert, update, delete on edie_space_invitations to edie_app;

alter table edie_organizations disable row level security;
alter table edie_space_invitations disable row level security;
