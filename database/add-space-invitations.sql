-- Run as the Neon project owner after add-space-members.sql.
-- Existing memberships remain active; newly inserted memberships default to
-- pending until the invited teacher accepts them.
alter table edie_space_members add column if not exists status text;

update edie_space_members set status = 'active' where status is null;

alter table edie_space_members
  alter column status set default 'pending',
  alter column status set not null;

alter table edie_space_members
  drop constraint if exists edie_space_members_status_check;

alter table edie_space_members
  add constraint edie_space_members_status_check
  check (status in ('pending', 'active'));

create index if not exists edie_space_members_email_status_idx
  on edie_space_members (email, status);
