-- One-time migration renaming all legacy "qwt" (quick-write-tool) objects to "edie".
-- Run as the Neon project owner BEFORE deploying the renamed application code.
-- After running this, rotate DATABASE_URL to use the edie_app role and set
-- EDIE_STORAGE_BACKEND=neon in place of QWT_STORAGE_BACKEND.
-- Idempotent: safe to run more than once.

begin;

-- Tables (order does not matter; references follow automatically).
alter table if exists qwt_teacher_spaces rename to edie_teacher_spaces;
alter table if exists qwt_sessions rename to edie_sessions;
alter table if exists qwt_submissions rename to edie_submissions;
alter table if exists qwt_question_bank rename to edie_question_bank;
alter table if exists qwt_poll_question_bank rename to edie_poll_question_bank;
alter table if exists qwt_prompt_history rename to edie_prompt_history;
alter table if exists qwt_group_questions rename to edie_group_questions;
alter table if exists qwt_group_question_votes rename to edie_group_question_votes;
alter table if exists qwt_polls rename to edie_polls;
alter table if exists qwt_poll_responses rename to edie_poll_responses;

-- Indexes (ALTER TABLE RENAME does not rename them).
alter index if exists qwt_submissions_session_created_idx rename to edie_submissions_session_created_idx;
alter index if exists qwt_submissions_image_object_key_unique_idx rename to edie_submissions_image_object_key_unique_idx;
alter index if exists qwt_submissions_session_status_idx rename to edie_submissions_session_status_idx;
alter index if exists qwt_submissions_session_archived_created_idx rename to edie_submissions_session_archived_created_idx;
alter index if exists qwt_sessions_space_created_idx rename to edie_sessions_space_created_idx;
alter index if exists qwt_sessions_space_code_idx rename to edie_sessions_space_code_idx;
alter index if exists qwt_question_bank_session_title_idx rename to edie_question_bank_session_title_idx;
alter index if exists qwt_poll_question_bank_session_title_idx rename to edie_poll_question_bank_session_title_idx;
alter index if exists qwt_prompt_history_session_started_idx rename to edie_prompt_history_session_started_idx;
alter index if exists qwt_group_questions_session_created_idx rename to edie_group_questions_session_created_idx;
alter index if exists qwt_group_questions_session_answered_created_idx rename to edie_group_questions_session_answered_created_idx;
alter index if exists qwt_group_questions_session_visible_created_idx rename to edie_group_questions_session_visible_created_idx;
alter index if exists qwt_group_questions_session_archived_created_idx rename to edie_group_questions_session_archived_created_idx;
alter index if exists qwt_group_question_votes_voter_idx rename to edie_group_question_votes_voter_idx;
alter index if exists qwt_polls_session_started_idx rename to edie_polls_session_started_idx;
alter index if exists qwt_polls_one_active_per_session_idx rename to edie_polls_one_active_per_session_idx;
alter index if exists qwt_poll_responses_poll_updated_idx rename to edie_poll_responses_poll_updated_idx;

-- Named check constraints (no ALTER ... IF EXISTS form, so guard manually).
-- Renaming while iterating pg_constraint needs the exception guard because
-- each rename invalidates the cursor row for that constraint on re-runs.
do $$
declare
  r record;
begin
  for r in
    select conname, conrelid::regclass as tbl
    from pg_constraint
    where contype = 'c' and conname like 'qwt_%'
  loop
    begin
      execute format('alter table %s rename constraint %I to %I',
        r.tbl,
        r.conname,
        'edie_' || substring(r.conname from 5));
    exception when duplicate_object or undefined_object then
      null;
    end;
  end loop;
end $$;

-- Application role. Grants are OID-based and survive the rename; only the
-- connection string username changes (update DATABASE_URL after this runs).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'qwt_app') then
    alter role qwt_app rename to edie_app;
  end if;
end $$;

commit;

-- Sanity check afterwards: these should return zero rows.
-- select tablename from pg_tables where tablename like 'qwt_%';
-- select indexname from pg_indexes where indexname like 'qwt_%';
