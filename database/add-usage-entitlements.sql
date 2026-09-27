-- Phase 3: organization-wide teacher seats and Cloud subscription snapshots.
-- Apply with the database owner before deploying the matching application code.

create table if not exists edie_organization_members (
  organization_id uuid not null references edie_organizations(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists edie_organization_members_user_idx
  on edie_organization_members (user_id);

insert into edie_organization_members (organization_id, user_id, role, created_at)
select organization.id, organization.personal_owner_user_id, 'owner', organization.created_at
from edie_organizations organization
where organization.personal_owner_user_id is not null
on conflict (organization_id, user_id) do update set role = 'owner';

insert into edie_organization_members (organization_id, user_id, role, created_at)
select distinct on (space.organization_id, member.user_id)
  space.organization_id,
  member.user_id,
  case when organization.personal_owner_user_id = member.user_id then 'owner' else 'member' end,
  member.created_at
from edie_space_members member
join edie_teacher_spaces space on space.code = member.space_code
join edie_organizations organization on organization.id = space.organization_id
order by space.organization_id, member.user_id, member.created_at
on conflict (organization_id, user_id) do update
set role = case
  when edie_organization_members.role = 'owner' or excluded.role = 'owner' then 'owner'
  else 'member'
end;

create table if not exists edie_subscriptions (
  organization_id uuid primary key references edie_organizations(id) on delete cascade,
  provider_customer_id text,
  provider_subscription_id text,
  plan_key text not null check (plan_key in ('free', 'pro')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create unique index if not exists edie_subscriptions_provider_customer_idx
  on edie_subscriptions (provider_customer_id) where provider_customer_id is not null;
create unique index if not exists edie_subscriptions_provider_subscription_idx
  on edie_subscriptions (provider_subscription_id) where provider_subscription_id is not null;

grant select, insert, update, delete on edie_organization_members to edie_app;
grant select on edie_subscriptions to edie_app;

alter table edie_organization_members disable row level security;
alter table edie_subscriptions disable row level security;
