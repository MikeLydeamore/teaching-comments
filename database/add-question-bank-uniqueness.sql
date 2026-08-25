-- Run as the Neon project owner for databases created before question-bank uniqueness.
-- This migration deliberately stops if existing duplicates need a human decision.
-- Run find-question-bank-duplicates.sql first to list the affected rows.
do $$
begin
  if exists (
    select 1
    from edie_question_bank
    group by session_code, lower(btrim(text))
    having count(*) > 1
  ) then
    raise exception 'Duplicate questions exist in edie_question_bank. Run database/find-question-bank-duplicates.sql, then remove or rename them before rerunning this migration.';
  end if;

  if exists (
    select 1
    from edie_poll_question_bank
    group by session_code, lower(btrim(question))
    having count(*) > 1
  ) then
    raise exception 'Duplicate questions exist in edie_poll_question_bank. Run database/find-question-bank-duplicates.sql, then remove or rename them before rerunning this migration.';
  end if;
end
$$;

create unique index if not exists edie_question_bank_session_text_unique_idx
  on edie_question_bank (session_code, lower(btrim(text)));

create unique index if not exists edie_poll_question_bank_session_question_unique_idx
  on edie_poll_question_bank (session_code, lower(btrim(question)));
