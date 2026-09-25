-- Phase 2 contract step. Run only after the organization backfill reports a
-- clean validation. Legacy membership columns remain until the rollback soak
-- period has completed.
alter table edie_teacher_spaces
  alter column organization_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'edie_space_members_active_user_id_check'
      and conrelid = 'edie_space_members'::regclass
  ) then
    alter table edie_space_members
      add constraint edie_space_members_active_user_id_check
      check (status <> 'active' or user_id is not null) not valid;
  end if;
end
$$;

alter table edie_space_members
  validate constraint edie_space_members_active_user_id_check;
