create table if not exists public.qwt_teacher_spaces (
  code text primary key check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  pin_hash text not null check (char_length(pin_hash) between 8 and 300),
  created_at timestamptz not null default now()
);

insert into public.qwt_teacher_spaces (code, name, pin_hash)
values ('default', 'Default Space', 'plain:teach123')
on conflict (code) do nothing;

alter table public.qwt_sessions
  add column if not exists space_code text;

update public.qwt_sessions
set space_code = 'default'
where space_code is null;

alter table public.qwt_sessions
  alter column space_code set default 'default';

alter table public.qwt_sessions
  alter column space_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'qwt_sessions_space_code_fkey'
  ) then
    alter table public.qwt_sessions
      add constraint qwt_sessions_space_code_fkey
      foreign key (space_code)
      references public.qwt_teacher_spaces(code)
      on delete restrict;
  end if;
end
$$;

create index if not exists qwt_sessions_space_created_idx
  on public.qwt_sessions (space_code, created_at desc);

create unique index if not exists qwt_sessions_space_code_idx
  on public.qwt_sessions (space_code, code);

alter table public.qwt_teacher_spaces enable row level security;
