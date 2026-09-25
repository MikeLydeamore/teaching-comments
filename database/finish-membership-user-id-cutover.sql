-- Contract step for stable user-ID memberships. Keep membership and invitation
-- changes paused, deploy the new application, then apply this immediately.
begin;

lock table edie_space_members, edie_space_invitations in access exclusive mode;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'edie_space_members'
      and column_name = 'status'
  ) then
    if exists (
      select 1 from edie_space_members
      where status = 'active' and user_id is null
    ) then
      raise exception 'Active space memberships without a user ID remain.';
    end if;

    if exists (
      select 1
      from edie_space_members membership
      where membership.user_id is null
        and not exists (
          select 1
          from edie_space_invitations invitation
          where invitation.space_code = membership.space_code
            and invitation.email = membership.email
        )
    ) then
      raise exception 'A legacy pending membership has no matching invitation.';
    end if;

    delete from edie_space_members where user_id is null;
  end if;
end
$$;

alter table edie_space_members
  drop constraint if exists edie_space_members_pkey,
  drop constraint if exists edie_space_members_status_check,
  drop constraint if exists edie_space_members_active_user_id_check;

drop index if exists edie_space_members_email_idx;
drop index if exists edie_space_members_email_status_idx;
drop index if exists edie_space_members_space_email_idx;
drop index if exists edie_space_members_space_user_active_idx;
drop index if exists edie_space_members_space_user_idx;

alter table edie_space_members
  alter column user_id set not null,
  add primary key (space_code, user_id),
  drop column if exists email,
  drop column if exists status;

commit;
