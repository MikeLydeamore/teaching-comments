begin;

alter table public.qwt_sessions
  add column if not exists id text;

update public.qwt_sessions
set id = code
where id is null;

alter table public.qwt_sessions
  alter column id set default gen_random_uuid()::text;

alter table public.qwt_sessions
  alter column id set not null;

do $$
declare
  fk_record record;
begin
  for fk_record in
    select constraint_table.oid::regclass as table_name, fk.conname
    from pg_constraint as fk
    join pg_class as constraint_table
      on constraint_table.oid = fk.conrelid
    where fk.contype = 'f'
      and fk.confrelid = 'public.qwt_sessions'::regclass
  loop
    execute format(
      'alter table %s drop constraint %I',
      fk_record.table_name,
      fk_record.conname
    );
  end loop;
end
$$;

alter table public.qwt_sessions
  drop constraint if exists qwt_sessions_pkey;

alter table public.qwt_sessions
  add constraint qwt_sessions_pkey primary key (id);

create unique index if not exists qwt_sessions_space_code_idx
  on public.qwt_sessions (space_code, code);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'qwt_question_bank',
    'qwt_poll_question_bank',
    'qwt_prompt_history',
    'qwt_group_questions',
    'qwt_polls',
    'qwt_submissions'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'alter table public.%I add constraint %I foreign key (session_code) references public.qwt_sessions(id) on delete cascade',
        table_name,
        table_name || '_session_code_fkey'
      );
    end if;
  end loop;
end
$$;

comment on column public.qwt_sessions.id is
  'Internal globally unique session identifier used by related records.';

comment on column public.qwt_sessions.code is
  'Public session code, unique only within space_code.';

commit;
