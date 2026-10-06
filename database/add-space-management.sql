-- Adds recoverable owner-managed space deletion to an existing database.
-- Apply with the database owner before deploying the matching application code.
alter table edie_teacher_spaces
  add column if not exists deleted_at timestamptz,
  add column if not exists purge_after timestamptz;

alter table edie_teacher_spaces
  drop constraint if exists edie_teacher_spaces_deletion_window_check;
alter table edie_teacher_spaces
  add constraint edie_teacher_spaces_deletion_window_check
  check (
    (deleted_at is null and purge_after is null)
    or (deleted_at is not null and purge_after > deleted_at)
  );

alter table edie_sessions
  drop constraint if exists edie_sessions_space_code_fkey;
alter table edie_sessions
  add constraint edie_sessions_space_code_fkey
  foreign key (space_code) references edie_teacher_spaces(code) on delete cascade;

grant delete on edie_teacher_spaces to edie_app;
