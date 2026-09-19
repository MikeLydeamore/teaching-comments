-- Run as the Neon project owner for databases created before accounts/ACL.
-- Membership is keyed by the teacher's login email so spaces can be shared
-- before the invitee has ever signed in. Better Auth guarantees one merged
-- account per verified email across Google/GitHub.
create extension if not exists citext;
create table if not exists edie_space_members (
  space_code text not null references edie_teacher_spaces(code) on delete cascade,
  email citext not null check (char_length(email) between 3 and 320),
  role text not null check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (space_code, email)
);
create index if not exists edie_space_members_email_idx on edie_space_members (email);

grant select, insert, update, delete on edie_space_members to edie_app;
