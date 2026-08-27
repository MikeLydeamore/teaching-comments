-- Provider-neutral fresh-install schema. Apply with an owner connection.
create extension if not exists pgcrypto;

create table if not exists edie_teacher_spaces (
  code text primary key check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  pin_hash text not null check (char_length(pin_hash) between 8 and 300),
  created_at timestamptz not null default now()
);
create table if not exists edie_sessions (
  id text primary key default gen_random_uuid()::text,
  code text not null check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  space_code text not null default 'default' references edie_teacher_spaces(code) on delete restrict,
  title text not null check (char_length(title) between 1 and 120), prompt text not null check (char_length(prompt) between 5 and 1200),
  is_open boolean not null default true, group_questions_screening_enabled boolean not null default false, submissions_screening_enabled boolean not null default false,
  text_input_enabled boolean not null default true, gif_input_enabled boolean not null default true, drawing_input_enabled boolean not null default true, image_input_enabled boolean not null default true,
  created_at timestamptz not null default now(), prompt_updated_at timestamptz not null default now(),
  timer_duration_seconds integer not null default 0 check (timer_duration_seconds between 0 and 3600), timer_ends_at timestamptz
);
create table if not exists edie_submissions (
  id uuid primary key default gen_random_uuid(), session_code text not null references edie_sessions(id) on delete cascade,
  student_name text not null default 'Anonymous' check (char_length(student_name) between 1 and 80), text text not null default '' check (char_length(text) <= 2000),
  drawing_data jsonb, gif_data jsonb, image_data jsonb, status text not null default 'visible' check (status in ('visible', 'hidden')),
  starred boolean not null default false, flagged boolean not null default false, version integer not null default 1 check (version >= 1), archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint edie_submissions_text_or_media_check check (char_length(text) >= 1 or drawing_data is not null or gif_data is not null or image_data is not null),
  constraint edie_submissions_drawing_data_check check (drawing_data is null or jsonb_typeof(drawing_data) = 'object'),
  constraint edie_submissions_gif_data_check check (gif_data is null or jsonb_typeof(gif_data) = 'object'),
  constraint edie_submissions_image_data_check check (image_data is null or (
    jsonb_typeof(image_data) = 'object' and image_data->>'version' = '1'
    and (image_data->>'objectKey') ~ '^committed/[A-Za-z0-9_-]{43}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\.(png|jpg|webp)$'
    and image_data->>'contentType' in ('image/png', 'image/jpeg', 'image/webp')
    and ((image_data->>'contentType' = 'image/png' and image_data->>'objectKey' ~ '\.png$') or (image_data->>'contentType' = 'image/jpeg' and image_data->>'objectKey' ~ '\.jpg$') or (image_data->>'contentType' = 'image/webp' and image_data->>'objectKey' ~ '\.webp$'))
    and jsonb_typeof(image_data->'byteSize') = 'number'
    and case when jsonb_typeof(image_data->'byteSize') = 'number' then (image_data->'byteSize')::numeric between 1 and 10485760 and (image_data->'byteSize')::numeric = trunc((image_data->'byteSize')::numeric) else false end
    and char_length(coalesce(image_data->>'etag', '')) between 1 and 256
  ))
);
create table if not exists edie_question_bank (
  id uuid primary key default gen_random_uuid(), session_code text not null references edie_sessions(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 1200), text text not null check (char_length(text) between 5 and 1200),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists edie_poll_question_bank (
  id uuid primary key default gen_random_uuid(), session_code text not null references edie_sessions(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500), question text not null check (char_length(question) between 1 and 500),
  selection_mode text not null check (selection_mode in ('single','multiple')), options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  correct_option_indexes jsonb not null default '[]'::jsonb check (jsonb_typeof(correct_option_indexes) = 'array'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists edie_prompt_history (
  id uuid primary key default gen_random_uuid(), session_code text not null references edie_sessions(id) on delete cascade,
  prompt text not null check (char_length(prompt) between 5 and 1200), started_at timestamptz not null, ended_at timestamptz,
  check (ended_at is null or ended_at > started_at)
);
create table if not exists edie_submission_view_settings (
  session_code text primary key references edie_sessions(id) on delete cascade,
  prompt_history_id uuid references edie_prompt_history(id) on delete set null,
  minutes integer not null default 3 check (minutes in (0,1,3,5,10)),
  sort_order text not null default 'newest' check (sort_order in ('newest','oldest')),
  starred_only boolean not null default false,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists edie_group_questions (
  id uuid primary key default gen_random_uuid(), session_code text not null references edie_sessions(id) on delete cascade,
  student_name text not null default 'Anonymous' check (char_length(student_name) between 1 and 80), text text not null check (char_length(text) between 5 and 500),
  is_answered boolean not null default false, is_visible boolean not null default true, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists edie_group_question_votes (
  question_id uuid not null references edie_group_questions(id) on delete cascade, voter_id text not null check (char_length(voter_id) between 8 and 120),
  created_at timestamptz not null default now(), primary key (question_id, voter_id)
);
create table if not exists edie_polls (
  id uuid primary key default gen_random_uuid(), session_code text not null references edie_sessions(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 500), selection_mode text not null check (selection_mode in ('single','multiple')),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  correct_option_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(correct_option_ids) = 'array'), solution_revealed boolean not null default false,
  status text not null default 'active' check (status in ('active','ended')),
  duration_seconds integer not null check (duration_seconds >= 5), started_at timestamptz not null default now(), ends_at timestamptz not null, ended_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (ends_at > started_at)
);
create table if not exists edie_poll_responses (
  poll_id uuid not null references edie_polls(id) on delete cascade, participant_id text not null check (char_length(participant_id) between 8 and 120),
  option_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(option_ids) = 'array'), updated_at timestamptz not null default now(), primary key (poll_id, participant_id)
);

create index if not exists edie_submissions_session_created_idx on edie_submissions (session_code, created_at desc);
create unique index if not exists edie_submissions_image_object_key_unique_idx on edie_submissions ((image_data->>'objectKey')) where image_data is not null;
create index if not exists edie_submissions_session_status_idx on edie_submissions (session_code, status);
create index if not exists edie_submissions_session_archived_created_idx on edie_submissions (session_code, archived_at, created_at desc);
create index if not exists edie_sessions_space_created_idx on edie_sessions (space_code, created_at desc);
create unique index if not exists edie_sessions_space_code_idx on edie_sessions (space_code, code);
create index if not exists edie_question_bank_session_title_idx on edie_question_bank (session_code, title);
create unique index if not exists edie_question_bank_session_text_unique_idx on edie_question_bank (session_code, lower(btrim(text)));
create index if not exists edie_poll_question_bank_session_title_idx on edie_poll_question_bank (session_code, title);
create unique index if not exists edie_poll_question_bank_session_question_unique_idx on edie_poll_question_bank (session_code, lower(btrim(question)));
create index if not exists edie_prompt_history_session_started_idx on edie_prompt_history (session_code, started_at desc);
create index if not exists edie_group_questions_session_created_idx on edie_group_questions (session_code, created_at desc);
create index if not exists edie_group_questions_session_answered_created_idx on edie_group_questions (session_code, is_answered, created_at desc);
create index if not exists edie_group_questions_session_visible_created_idx on edie_group_questions (session_code, is_visible, created_at desc);
create index if not exists edie_group_questions_session_archived_created_idx on edie_group_questions (session_code, archived_at, created_at desc);
create index if not exists edie_group_question_votes_voter_idx on edie_group_question_votes (voter_id);
create index if not exists edie_polls_session_started_idx on edie_polls (session_code, started_at desc);
create unique index if not exists edie_polls_one_active_per_session_idx on edie_polls (session_code) where status = 'active';
create index if not exists edie_poll_responses_poll_updated_idx on edie_poll_responses (poll_id, updated_at desc);

-- Retained for compatibility with hosted Postgres providers that grant broad owner rights by default.
-- A Neon edie_app role needs explicit grants instead.
alter table edie_teacher_spaces enable row level security;
alter table edie_sessions enable row level security;
alter table edie_submissions enable row level security;
alter table edie_question_bank enable row level security;
alter table edie_poll_question_bank enable row level security;
alter table edie_prompt_history enable row level security;
alter table edie_submission_view_settings enable row level security;
alter table edie_group_questions enable row level security;
alter table edie_group_question_votes enable row level security;
alter table edie_polls enable row level security;
alter table edie_poll_responses enable row level security;

insert into edie_teacher_spaces (code,name,pin_hash) values ('default','Default Space','plain:teach123') on conflict (code) do nothing;
insert into edie_sessions (id,code,space_code,title,prompt,is_open) values ('demo-lecture','demo-lecture','default','Demo Lecture','In one or two sentences, explain what the p-value tells us in this setting.',true) on conflict (space_code,code) do nothing;
insert into edie_prompt_history (id,session_code,prompt,started_at,ended_at)
select '44444444-4444-4444-8444-444444444444',id,prompt,prompt_updated_at,null from edie_sessions where id='demo-lecture' on conflict (id) do nothing;
insert into edie_question_bank (id,session_code,title,text) values ('33333333-3333-4333-8333-333333333333','demo-lecture','Explain p-values','In one or two sentences, explain what the p-value tells us in this setting.') on conflict (id) do nothing;
insert into edie_submissions (id,session_code,student_name,text,status,starred,flagged,version) values
('11111111-1111-4111-8111-111111111111','demo-lecture','Anonymous','There is no evidence against the null model, so the observed difference could be due to random variation.','visible',false,false,1),
('22222222-2222-4222-8222-822222222222','demo-lecture','Anonymous','The p-value is 0.28, which is not small enough to suggest the bird type proportions are different.','visible',true,false,1)
on conflict (id) do nothing;
