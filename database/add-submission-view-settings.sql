-- Apply with an owner connection before deploying session-wide submission views.
create table if not exists edie_submission_view_settings (
  session_code text primary key references edie_sessions(id) on delete cascade,
  prompt_history_id uuid references edie_prompt_history(id) on delete set null,
  minutes integer not null default 3 check (minutes in (0,1,3,5,10)),
  sort_order text not null default 'newest' check (sort_order in ('newest','oldest')),
  starred_only boolean not null default false,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

grant select, insert, update on edie_submission_view_settings to edie_app;
alter table edie_submission_view_settings disable row level security;
